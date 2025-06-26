import {autorun, makeAutoObservable, observable, reaction, untracked} from 'mobx'
import type {ComponentStore} from '../../../stores/ComponentStore'
import {isComputedProperty} from '../../../stores/ComponentStore'
import type {ComponentData} from '../../../utils/contexts/ComponentDataContext'
import {needRender} from '../../../utils/needRender'
import {nameAutorun, nameObservable} from '../../../utils/observableNaming'
import type {Model} from '../../define'
import type {SchemaType} from '../types/SchemaType'
import type {ValidationMessages} from '../types/ValidationResult'
import {autoConvertField} from './autoConvertField'
import type {CalculatePropertyFn} from './CalculatePropertyFn'
import type {DataValidator} from './DataValidator'
import type {DataValidatorFactoryFn} from './DataValidatorFactoryFn'
import type {Disposer} from './Disposer'
import type {Field} from './Field'
import type {FieldType} from './FieldType'
import type {GetInitialDataFn} from './GetInitialDataFn'

/**
 * Field with form data, contains only one value. **Internal use only.**
 */
export class SimpleField implements Field {

  #oldDataValidator?: DataValidator

  /**
   * @inheritDoc
   */
  error?: string

  /**
   * @inheritDoc
   */
  touched = false

  /**
   * @inheritDoc
   */
  value: unknown = undefined

  /**
   * @inheritDoc
   */
  valued: string
  /**
   * The type of the field value.
   */
  valueType: SchemaType
  dataValidator?: DataValidator
  readonly #disposers: Disposer[]
  readonly componentStore: ComponentStore
  readonly model: Model

  /**
   * Creates the field with form data for the component.
   * @param componentData the component data.
   * @param calculateValue the function for calculating the value of the field.
   * @param createDataValidator the function to create a data validator.
   * @param getInitialData the function to get initial data for the field.
   * @param deferFieldCalculation if true, then the calculated field must be explicitly initialized.
   */
  constructor(
    readonly componentData: ComponentData,
    readonly calculateValue: CalculatePropertyFn,
    readonly createDataValidator: DataValidatorFactoryFn,
    readonly getInitialData: GetInitialDataFn,
    public deferFieldCalculation: boolean,
  ) {
    const {model, store: componentStore} = componentData
    this.componentStore = componentStore
    this.model = model

    if (!model.valued) throw new Error(`'model.valued' is falsy`)
    if (!model.valueType) throw new Error(`'model.typeOfValue' is undefined`)
    this.valued = model.valued
    this.valueType = model.valueType

    const className = 'SimpleField'

    makeAutoObservable(this, {
      model: false,
      dataValidator: observable.ref,
    }, {name: nameObservable(className, {key: componentStore.key}), autoBind: true})

    // first, we initialize the value
    this.value = this.isComputed ? this.computedValue : this.initialDataValue

    this.#disposers = [
      autorun(
        () => {
          this.dataValidator = this.createDataValidator(
            componentData,
            this.valueType,
            error => this.error = error
          )
          untracked(() => {
            this.#oldDataValidator?.dispose()
            this.#oldDataValidator = this.dataValidator
          })
        }
        , {name: nameAutorun(className, 'setValidator', {key: componentStore.key})}),
      () => this.dataValidator?.dispose()
    ]

    // then, sign up for data changes, this could be:
    // 1. changing the form data.
    // 2. automatic recalculation of the value if the property is computable.
    // 3. if the data change has occurred, we save the value in the field.
    this.#disposers.push(
      reaction(() => ({
        isComputed: this.isComputed,
        computedValue: this.computedValue,
        initialDataValue: this.initialDataValue
      }), (data) => {
        this.value = data.isComputed ? data.computedValue : data.initialDataValue
      }, {name: nameObservable(className, {key: this.componentStore.key})})
    )
  }

  /**
   * @inheritDoc
   */
  get fieldType(): FieldType {
    return 'simple'
  }

  /**
   * @inheritDoc
   */
  init() {
    this.deferFieldCalculation = false

    if (this.isComputed) {
      // we set the value asynchronously to prevent loops in MobX
      setTimeout(() => {
        this.value = this.computedValue
      }, 0)
      return
    }

    this.value = this.initialDataValue
  }

  /**
   * @returns the initial value for the field.
   */
  get initialValue() {
    return this.componentStore.props[this.valued]?.value ?? this.defaultValue
  }

  /**
   * @returns the default value for the field.
   */
  get defaultValue() {
    return this.model.defaultProps?.[this.valued]
  }

  /**
   * @inheritDoc
   */
  dispose() {
    this.#disposers.forEach(dispose => dispose())
  }

  /**
   * @inheritDoc
   */
  setValue(value: unknown) {
    this.innerSetValue(autoConvertField(value, this.valueType))
    if (!this.needValidate) {
      this.clearError()
      return
    }
    if (this.componentStore.schema?.autoValidate !== false) {
      this.dataValidator?.sendValidationEvent?.(this.value)
    }
  }

  /**
   * @inheritDoc
   */
  setTouched() {
    this.touched = true
  }

  /**
   * @inheritDoc
   */
  async validate() {
    if (!this.needValidate) {
      this.clearError()
      return
    }
    await this.dataValidator?.validate?.(this.value)
  }

  /**
   * @inheritDoc
   */
  async getValidationResult() {
    if (!this.needValidate) return
    const result = await this.dataValidator?.getValidationResult?.(this.value)
    return result?.map(({message}) => message) as ValidationMessages
  }

  /**
   * @inheritDoc
   */
  reset() {
    this.innerSetValue(this.initialValue ?? this.defaultValue)
    this.clearError()
  }

  /**
   * @inheritDoc
   */
  clear() {
    this.innerSetValue(this.defaultValue)
    this.touched = false
    this.clearError()
  }

  /**
   * @returns true if the field should be validated, false otherwise.
   */
  get needValidate() {
    return needRender(this.componentStore, this.componentData.dataRoot)
  }

  /**
   * Clears the error message for this field.
   */
  clearError() {
    this.error = undefined
  }

  /**
   * Sets the error value.
   * @param error the error value to be set. If the error is `undefined` or `null`, the error value will be reset to `undefined`.
   * @throws {Error} throws an error if the provided value is not a string, undefined, or null.
   */
  setError = (error: unknown) => {
    if (typeof error === 'string') {
      this.error = error
    } else if (typeof error === 'undefined' || error === null) {
      this.error = undefined
    } else {
      throw new Error(`Expected 'string | undefined | null' type, got '${typeof error}'`)
    }
  }

  /**
   * @returns the initial data value for the field.
   */
  get initialDataValue() {
    return this.getInitialData() ?? this.initialValue
  }

  /**
   * @returns the computed value for the field.
   */
  get computedValue() {
    // to calculate the value of a calculated field,
    // we need the form data, i.e., in particular the value from this SimpleField (value).
    if (this.deferFieldCalculation) return this.initialDataValue
    const [, value] = this.calculateValue(this.componentStore, this.valued)
    return value
  }

  /**
   * @returns true if the field value is calculated, otherwise false.
   */
  get isComputed() {
    return isComputedProperty(this.componentStore.props[this.valued])
  }

  /**
   * Sets the value of the field without converting it.
   * @param value the value to be set.
   */
  innerSetValue(value: unknown) {
    this.value = value
  }
}

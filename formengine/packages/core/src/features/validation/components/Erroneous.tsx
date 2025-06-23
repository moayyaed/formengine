import {createElement, useCallback} from 'react'
import type {ComponentStoreLocalizer} from '../../../stores/ComponentStoreLocalizer'
import type {WrapperProps} from '../../../types'
import {namedObserver} from '../../../utils'
import {useComponentData} from '../../../utils/contexts/ComponentDataContext'
import {useStore} from '../../../utils/contexts/StoreContext'
import {useErrorModel} from '../../../utils/useErrorModel'
import {useWrapperState} from '../../../utils/useWrapperState'
import {useViewerProps} from '../../form-viewer/components/ViewerPropsContext'

const RawErroneous = ({children}: WrapperProps) => {
  const wrappedComponentData = useComponentData()
  const viewerStore = useStore()
  const props = useViewerProps()
  const errorDefinition = useErrorModel()

  const localizer = useCallback<ComponentStoreLocalizer>(() => ({}), [])
  const componentState = useWrapperState(wrappedComponentData, errorDefinition, viewerStore.form.errorProps, localizer)

  if (props.erroneous) return <>{children}</>

  const errorProps = {...componentState.ownProps, error: wrappedComponentData.field?.error}
  return createElement(errorDefinition.component, errorProps, children)
}

export const Erroneous = namedObserver('Erroneous', RawErroneous)

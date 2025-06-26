import {reduce} from 'lodash-es'
import {string} from './index'
import type {Annotation} from './types/annotations/Annotation'
import type {Annotations} from './utils/builders/Annotations'
import type {BuilderSetup} from './utils/builders/BaseBuilder'

/**
 * Converts the object containing component property metadata into an array. **Internal use only.**
 * @param annotations the object containing component property metadata.
 * @param setup the custom options for the component's property metadata builder.
 * @returns the metadata array of the component properties.
 */
export function toArray<T extends object = any>(annotations?: Annotations<T>, setup: BuilderSetup = {}) {
  return reduce(annotations, (prev: Annotation[], value, key) => {
    prev.push(value?.setup(setup)?.build(key) ?? string.setup(setup).build(key))
    return prev
  }, [])
}

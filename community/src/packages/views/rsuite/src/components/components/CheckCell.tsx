import styled from '@emotion/styled'
import {Checkbox} from 'rsuite'
import type {InputCellProps} from './InputCellProps'
import {SCell} from './SCell'

const SCheckbox = styled(Checkbox)`
  & .rs-checkbox-wrapper {
    left: 4px;
    top: 6px;
  }
`

/**
 * The React component that displays the table cell with the checkbox.
 * @param props the React component properties.
 * @param props.rowData the row data.
 * @param props.dataKey the key name in {@link props.rowData}.
 * @param props.rowIndex the row index.
 * @param props.onChange the onChange event of the checkbox.
 * @param props.props the other properties of the component.
 * @returns the React element.
 */
export const CheckCell = ({rowData, dataKey, rowIndex, onChange, ...props}: InputCellProps) => {
  const handleChange = (_: any, checked: boolean) => {
    rowData[dataKey] = checked
    onChange?.(checked, dataKey, rowIndex)
  }
  return (
    <SCell {...props}>
      <SCheckbox inline checked={rowData[dataKey] ?? false} onChange={handleChange}/>
    </SCell>
  )
}

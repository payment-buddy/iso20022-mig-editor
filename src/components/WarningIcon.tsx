import type {CSSProperties} from "react"

export function WarningIcon({title, style}: {title: string, style?: CSSProperties}) {
    return (
        <span title={title} style={{color: 'orangered', cursor: 'default', ...style}}>&#x26A0;</span>
    )
}

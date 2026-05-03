import type {CSSProperties} from "react"

export function WarningIcon({style}: {style?: CSSProperties}) {
    return (
        <span style={{color: 'orangered', ...style}}>&#x26A0;</span>
    )
}

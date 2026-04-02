import type {ReactNode} from "react"

export function DetailPanel({children}: {children: ReactNode}) {
    return (
        <div style={{flex: 4, position: 'sticky', top: 0, alignSelf: 'flex-start', maxHeight: '100vh', overflowY: 'auto'}}>
            {children}
        </div>
    )
}

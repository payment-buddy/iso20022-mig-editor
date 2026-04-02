export function LoadingIndicator() {
    return (
        <>
            <style>{'@keyframes iso-dot{0%,80%,100%{opacity:0}40%{opacity:1}}'}</style>
            Loading
            <span>
                <span style={{animation: 'iso-dot 1.4s 0.0s infinite'}}>.</span>
                <span style={{animation: 'iso-dot 1.4s 0.2s infinite'}}>.</span>
                <span style={{animation: 'iso-dot 1.4s 0.4s infinite'}}>.</span>
            </span>
        </>
    )
}

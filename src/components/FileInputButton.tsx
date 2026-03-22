import {useRef} from "react";

export function FileInputButton({label, accept, onFile}: {
    label: string
    accept: string
    onFile: (file: File) => void
}) {
    const ref = useRef<HTMLInputElement>(null)
    return (
        <>
            <input ref={ref} type="file" accept={accept} style={{display: 'none'}}
                   onChange={e => {
                       const f = e.target.files?.[0]
                       if (f) { onFile(f); e.target.value = '' }
                   }}/>
            <button onClick={() => ref.current?.click()}>{label}</button>
        </>
    )
}

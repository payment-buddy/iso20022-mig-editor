import {useCallback, useRef, useState} from 'react'
import {parseRepository} from "./eRepository.js"
import type {ERepository} from "./types.ts";

type Status = 'idle' | 'parsing' | 'error'

export function FileUploader({onParsed}: {
    onParsed: (result: ERepository) => void
}) {
    const [status, setStatus] = useState<Status>('idle')
    const inputRef = useRef<HTMLInputElement>(null)

    const handleFile = useCallback(async (file: File) => {
        setStatus('parsing')
        try {
            const result = await parseRepository(file)
            onParsed(result)
            setStatus('idle')
        } catch (err) {
            console.error('Failed to parse eRepository file:', err)
            setStatus('error')
        }
    }, [onParsed])

    return (
        <div>
            <p>Load ISO 20022 <a href="https://www.iso20022.org/iso20022-repository/e-repository" target="_blank"
                                 rel="noopener noreferrer">e-Repository</a> file</p>
            <input
                ref={inputRef}
                type="file"
                accept=".iso20022,.zip"
                disabled={status === 'parsing'}
                style={{width: '500px'}}
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                        handleFile(f)
                    }
                }}
            />
            {status === 'parsing' && (
                <p>
                    <style>{`@keyframes iso-dot{0%,80%,100%{opacity:0}40%{opacity:1}}`}</style>
                    Loading
                    <span>
                        <span style={{animation: 'iso-dot 1.4s 0.0s infinite'}}>.</span>
                        <span style={{animation: 'iso-dot 1.4s 0.2s infinite'}}>.</span>
                        <span style={{animation: 'iso-dot 1.4s 0.4s infinite'}}>.</span>
                    </span>
                </p>
            )}
            {status === 'error' && (
                <p style={{color: 'red'}}>
                    Failed to parse file.
                </p>
            )}
        </div>
    )
}
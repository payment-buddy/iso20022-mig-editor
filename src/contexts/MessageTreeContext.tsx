import {createContext, useContext} from "react"
import type {Constraint, DataTypes, ElementOverrides, MessageElement} from "../types/types.ts"

export interface MessageTreeContextValue {
    dataTypes: DataTypes
    overrides: ElementOverrides
    showXmlTags: boolean
    selectedPath: string
    hideExcluded: boolean
    onSelectElement: (element: MessageElement, xmlPath: string) => void
    onSelectConstraint: (constraint: Constraint, xmlPath: string) => void
}

export const MessageTreeContext = createContext<MessageTreeContextValue | null>(null)

export function useMessageTreeContext(): MessageTreeContextValue {
    const context = useContext(MessageTreeContext)
    if (!context) {
        throw new Error("useMessageTreeContext must be used within MessageTreeContext.Provider")
    }
    return context
}

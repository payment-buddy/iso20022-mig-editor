import sax from "sax"
import { unzipToStream } from "@/core/utils/unzip"
import type { RepoCodeSet } from "@/core/mig/expression/codeListResolver"
import type {
  BusinessArea,
  ComplexType,
  Constraint,
  DataTypes,
  ERepository,
  MessageDefinition,
  MessageElement,
  MessageSet,
  SimpleType,
} from "@/core/types/types"

export async function parseRepository(file: File): Promise<ERepository> {
  const parser = sax.parser(true) // strict mode — attribute names kept as-is

  const dataTypes: DataTypes = {} // xmi:id → DataType
  const businessAreas: BusinessArea[] = []
  const codeSets: RepoCodeSet[] = []
  // MessageSets reference member messages by xmi:id; resolved to identifiers
  // after parsing (once every message definition is known).
  const rawMessageSets: { name: string; definition: string; ids: string[] }[] =
    []
  const messageElementTypes: {
    messageElement: MessageElement
    typeId: string
  }[] = []
  let businessArea: BusinessArea | null = null
  let complexType: ComplexType | null = null
  let simpleType: SimpleType | null = null
  let codeSet: RepoCodeSet | null = null
  let messageElement: MessageElement | null = null
  let messageDefinition: MessageDefinition | null = null
  let exampleText: string | null = null
  const num = (v: string | undefined) => (v != null ? Number(v) : null)
  const int = (v: string | undefined) => (v != null ? parseInt(v, 10) : null)

  parser.onopentag = (node: sax.Tag) => {
    if (node.name === "example") {
      exampleText = ""
      return
    }

    const attrs = node.attributes
    const xsiType = attrs["xsi:type"]

    if (node.name === "topLevelCatalogueEntry") {
      if (xsiType === "iso20022:BusinessArea") {
        if (attrs["registrationStatus"] !== "Obsolete") {
          businessArea = {
            name: attrs["name"],
            definition: attrs["definition"] ?? "",
            code: attrs["code"] ?? " ",
            messages: [],
          }
        }
      } else if (xsiType === "iso20022:MessageSet") {
        if (attrs["registrationStatus"] !== "Obsolete") {
          rawMessageSets.push({
            name: attrs["name"],
            definition: attrs["definition"] ?? "",
            // Space-separated list of member message-definition xmi:ids.
            ids: (attrs["messageDefinition"] ?? "").split(/\s+/).filter(Boolean),
          })
        }
      }
    } else if (node.name === "topLevelDictionaryEntry") {
      if (
        xsiType === "iso20022:MessageComponent" ||
        xsiType === "iso20022:ChoiceComponent"
      ) {
        complexType = {
          name: attrs["name"],
          definition: attrs["definition"] ?? "",
          isChoice: xsiType === "iso20022:ChoiceComponent",
          elements: [],
          constraints: [],
        }
        dataTypes[attrs["xmi:id"]] = complexType
      } else if (xsiType === "iso20022:BusinessComponent") {
        // skip
      } else {
        simpleType = {
          name: attrs["name"],
          definition: attrs["definition"] ?? "",
          baseType: xsiType?.replace(/^iso20022:/, "") ?? null,
          minInclusive: num(attrs["minInclusive"]),
          maxInclusive: num(attrs["maxInclusive"]),
          length: int(attrs["length"]),
          minLength: int(attrs["minLength"]),
          maxLength: int(attrs["maxLength"]),
          totalDigits: int(attrs["totalDigits"]),
          fractionDigits: int(attrs["fractionDigits"]),
          pattern: attrs["pattern"] ?? null,
          baseValue: attrs["baseValue"] ?? null,
          codes: [],
          constraints: [],
          examples: [],
          currencyIdentifierSet: attrs["currencyIdentifierSet"] ?? null,
        }
        dataTypes[attrs["xmi:id"]] = simpleType
        // CodeSets are also captured separately (with name/trace and code names,
        // which the SimpleType/Code model drops) for the WithInList resolver.
        if (xsiType === "iso20022:CodeSet") {
          codeSet = {
            id: attrs["xmi:id"],
            name: attrs["name"],
            trace: attrs["trace"],
            codes: [],
          }
          codeSets.push(codeSet)
        }
      }
    }

    if (node.name === "messageElement") {
      if (complexType) {
        const typeId =
          attrs["complexType"] ?? attrs["type"] ?? attrs["simpleType"]
        messageElement = {
          id: attrs["xmi:id"],
          name: attrs["name"],
          xmlTag: attrs["xmlTag"],
          isAttribute: false,
          isChoice: false,
          definition: attrs["definition"] ?? "",
          minOccurs: int(attrs["minOccurs"]) ?? 1,
          maxOccurs: int(attrs["maxOccurs"]),
          typeId: typeId,
          type: "",
          baseType: null,
          minInclusive: null,
          maxInclusive: null,
          totalDigits: null,
          fractionDigits: null,
          length: null,
          minLength: null,
          maxLength: null,
          pattern: null,
          baseValue: null,
          codes: [],
          constraints: [],
          examples: [],
          elements: [],
        }
        messageElementTypes.push({ messageElement, typeId })
        complexType.elements.push(messageElement)
      }
    } else if (node.name === "messageDefinition") {
      if (businessArea && attrs["registrationStatus"] !== "Obsolete") {
        complexType = {
          name: attrs["name"],
          definition: "",
          isChoice: false,
          elements: [],
          constraints: [],
        }
        dataTypes[attrs["xmi:id"]] = complexType
        messageElement = {
          id: attrs["xmi:id"],
          name: attrs["name"],
          xmlTag: attrs["xmlTag"],
          isAttribute: false,
          isChoice: false,
          definition: attrs["definition"] ?? "",
          minOccurs: 1,
          maxOccurs: 1,
          typeId: attrs["xmi:id"],
          type: "",
          baseType: null,
          minInclusive: null,
          maxInclusive: null,
          totalDigits: null,
          fractionDigits: null,
          length: null,
          minLength: null,
          maxLength: null,
          pattern: null,
          baseValue: null,
          codes: [],
          constraints: [],
          examples: [],
          elements: [],
        }
        messageElementTypes.push({ messageElement, typeId: attrs["xmi:id"] })
        messageDefinition = {
          name: attrs["name"],
          identifier: "",
          shortCode: "",
          rootElement: messageElement,
        }
        businessArea.messages.push(messageDefinition)
      }
    } else if (node.name === "messageBuildingBlock") {
      if (complexType) {
        const typeId =
          attrs["complexType"] ?? attrs["type"] ?? attrs["simpleType"]
        messageElement = {
          id: attrs["xmi:id"],
          name: attrs["name"],
          xmlTag: attrs["xmlTag"] ?? "",
          isAttribute: false,
          isChoice: false,
          definition: attrs["definition"] ?? "",
          minOccurs: int(attrs["minOccurs"]) ?? 1,
          maxOccurs: int(attrs["maxOccurs"]),
          typeId: typeId,
          type: "",
          baseType: null,
          minInclusive: null,
          maxInclusive: null,
          totalDigits: null,
          fractionDigits: null,
          length: null,
          minLength: null,
          maxLength: null,
          pattern: null,
          baseValue: null,
          codes: [],
          constraints: [],
          examples: [],
          elements: [],
        }
        messageElementTypes.push({ messageElement, typeId })
        complexType.elements.push(messageElement)
      }
    } else if (node.name === "messageDefinitionIdentifier") {
      if (messageDefinition) {
        const { businessArea, messageFunctionality, flavour, version } = attrs
        messageDefinition.identifier =
          businessArea +
          "." +
          messageFunctionality +
          "." +
          flavour +
          "." +
          version
        messageDefinition.shortCode = businessArea + "." + messageFunctionality
      }
    } else if (node.name === "code") {
      if (simpleType && attrs["codeName"]) {
        simpleType.codes.push({
          codeName: attrs["codeName"],
          definition: attrs["definition"],
        })
      }
      // A validation-rule CodeSet's codes carry only `name` (no `codeName`); the
      // wire value is resolved via `trace` later, so capture them regardless.
      if (codeSet && attrs["name"]) {
        codeSet.codes.push({
          name: attrs["name"],
          codeName: attrs["codeName"],
        })
      }
    } else if (node.name === "constraint") {
      const constraint: Constraint = {
        name: attrs["name"],
        definition: attrs["definition"],
      }
      // The raw ISO RuleDefinition XML (SAX has already entity-decoded it); the
      // DSL form is derived later in `enrichMessageDsl`.
      if (attrs["expression"]) constraint.isoExpression = attrs["expression"]
      if (messageElement) {
        messageElement.constraints.push(constraint)
      } else if (simpleType) {
        simpleType.constraints.push(constraint)
      } else if (complexType) {
        complexType.constraints.push(constraint)
      }
    }
  }

  parser.ontext = (text) => {
    if (exampleText !== null) exampleText += text
  }

  parser.onclosetag = (name) => {
    if (name === "example") {
      const value = exampleText?.trim()
      if (value) {
        if (messageElement) {
          messageElement.examples.push(value)
        } else if (simpleType) {
          simpleType.examples.push(value)
        }
      }
      exampleText = null
    } else if (name === "topLevelDictionaryEntry") {
      complexType = null
      simpleType = null
      codeSet = null
    } else if (name === "messageDefinition") {
      messageDefinition = null
    } else if (name === "messageElement" || name === "messageBuildingBlock") {
      messageElement = null
    } else if (name === "topLevelCatalogueEntry" && businessArea) {
      businessAreas.push(businessArea)
      businessArea = null
    }
  }

  const stream = file.name.endsWith(".zip")
    ? unzipToStream(file)
    : file.stream()
  const reader = stream.getReader()
  const decoder = new TextDecoder("utf-8")
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    parser.write(
      decoder.decode(value, { stream: true }).replace(/&#xD;&#xA;/g, "&#xA;")
    )
  }
  parser.close()

  for (const ba of businessAreas) {
    ba.messages.sort((a, b) => a.identifier.localeCompare(b.identifier))
  }
  for (const { messageElement, typeId } of messageElementTypes) {
    const type = dataTypes[typeId]
    const complexType = type as ComplexType
    const simpleType = type as SimpleType
    messageElement.type = type.name
    if ("isChoice" in type) {
      messageElement.isChoice = complexType.isChoice
    }
    if (type.constraints) {
      messageElement.constraints.push(...type.constraints)
    }
    if (complexType.elements) {
      messageElement.elements.push(...(type as ComplexType).elements)
    }
    if ("examples" in type) {
      messageElement.baseType = simpleType.baseType
      messageElement.minInclusive = simpleType.minInclusive
      messageElement.maxInclusive = simpleType.maxInclusive
      messageElement.totalDigits = simpleType.totalDigits
      messageElement.fractionDigits = simpleType.fractionDigits
      messageElement.length = simpleType.length
      messageElement.minLength = simpleType.minLength
      messageElement.maxLength = simpleType.maxLength
      messageElement.pattern = simpleType.pattern
      messageElement.baseValue = simpleType.baseValue
      messageElement.codes.push(...simpleType.codes)
      messageElement.examples.push(...simpleType.examples)
      if (simpleType.currencyIdentifierSet) {
        const ccyData = dataTypes[simpleType.currencyIdentifierSet]
        messageElement.elements.push({
          id: messageElement.id + "/Ccy",
          name: "Currency",
          xmlTag: "Ccy",
          isAttribute: true,
          isChoice: false,
          definition: "",
          minOccurs: 1,
          maxOccurs: 1,
          typeId: simpleType.currencyIdentifierSet,
          type: ccyData?.name ?? "",
          baseType: null,
          minInclusive: null,
          maxInclusive: null,
          totalDigits: null,
          fractionDigits: null,
          length: null,
          minLength: null,
          maxLength: null,
          pattern: null,
          baseValue: null,
          codes: [],
          constraints: [],
          examples: [],
          elements: [],
        })
      }
    }
  }

  // Resolve each MessageSet's member xmi:ids to message identifiers (a message
  // definition's xmi:id is its root element's id). Refs to messages we didn't
  // keep (obsolete/unparsed) drop out; empty sets are omitted.
  const identifierByXmiId = new Map<string, string>()
  for (const ba of businessAreas)
    for (const m of ba.messages)
      identifierByXmiId.set(m.rootElement.id, m.identifier)

  const messageSets: MessageSet[] = rawMessageSets
    .map((s) => ({
      name: s.name,
      definition: s.definition,
      messageIdentifiers: s.ids
        .map((id) => identifierByXmiId.get(id))
        .filter((id): id is string => id !== undefined),
    }))
    .filter((s) => s.messageIdentifiers.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name))

  return { businessAreas, codeSets, messageSets }
}

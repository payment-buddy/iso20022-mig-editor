# Contraint Expression Format Specification

The `expression` field of constraint contains an XML document that defines the validation logic.

### Rule Types

#### SimpleRule

Used for straightforward presence/absence checks with a single logical connector.

```xml
<SimpleRule xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="SimpleRule">
  <mustBe>
    <connector>AND | OR</connector>
    <BooleanRule xsi:type="Presence | Absence">
      <leftOperand>/XPath/To/Element</leftOperand>
    </BooleanRule>
    ...
  </mustBe>
</SimpleRule>
```

#### ComplexRule

Used for conditional rules where the `mustBe` constraint applies only when the `onCondition` is met.

```xml
<ComplexRule xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="ComplexRule">
  <mustBe>
    <connector>AND | OR</connector>
    <BooleanRule xsi:type="Presence | Absence">
      <leftOperand>/XPath/To/Element</leftOperand>
    </BooleanRule>
  </mustBe>
  <onCondition>
    <connector>AND | OR</connector>
    <BooleanRule xsi:type="Presence | Absence">
      <leftOperand>/XPath/To/Element</leftOperand>
    </BooleanRule>
  </onCondition>
</ComplexRule>
```

### BooleanRule Types

| Type                 | Description                                                                                 |
|----------------------|---------------------------------------------------------------------------------------------|
| `Presence`           | The element must exist in the document                                                      |
| `Absence`            | The element must not exist in the document                                                  |
| `EqualToNode`        | The value/attribute of `leftOperand` must equal the value/attribute of `rightOperand`       |
| `EqualToValue`       | The value/attribute of `leftOperand` must equal the literal value in `rightOperand`         |
| `DifferentFromNode`  | The value/attribute of `leftOperand` must differ from the value/attribute of `rightOperand` |
| `DifferentFromValue` | The value/attribute of `leftOperand` must differ from the literal value in `rightOperand`   |
| `WithInList`         | The value/attribute of `leftOperand` must be in the list defined in `rightOperand`          |
| `NotWithInList`      | The value/attribute of `leftOperand` must not be in the list defined in `rightOperand`      |

### Connectors

| Connector   | Description                         |
|-------------|-------------------------------------|
| `AND`       | All conditions must be true         |
| `OR`        | At least one condition must be true |

### XPath-like Paths

The `leftOperand` and `rightOperand` use XPath-like notation to reference elements:

- `/ElementName` - Root-level element
- `/Parent/Child` - Nested element path
- `/Element[index]` - Array element by index (1-based)
- `/Element/@Attribute` - Reference an attribute of an element
- `/Parent[*]/Child/@Attr` - Wildcard path matching all occurrences

## Examples

### Example 1: Either/Or Rule

**Definition:** Either SafekeepingAccount or BlockChainAddressOrWallet must be present but not both.

```xml
<RuleDefinition>
  <SimpleRule xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="SimpleRule">
    <mustBe>
      <connector>OR</connector>
      <BooleanRule xsi:type="Presence">
        <leftOperand>/SafekeepingAccount</leftOperand>
      </BooleanRule>
      <BooleanRule xsi:type="Presence">
        <leftOperand>/BlockChainAddressOrWallet</leftOperand>
      </BooleanRule>
    </mustBe>
  </SimpleRule>
</RuleDefinition>
```

### Example 2: Conditional Rule

**Definition:** If BlockChainAddressOrWallet is present then SafekeepingAccount must be absent.

```xml
<RuleDefinition>
  <ComplexRule xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="ComplexRule">
    <mustBe>
      <connector>AND</connector>
      <BooleanRule xsi:type="Absence">
        <leftOperand>/SafekeepingAccount</leftOperand>
      </BooleanRule>
    </mustBe>
    <onCondition>
      <connector>AND</connector>
      <BooleanRule xsi:type="Presence">
        <leftOperand>/BlockChainAddressOrWallet</leftOperand>
      </BooleanRule>
    </onCondition>
  </ComplexRule>
</RuleDefinition>
```

### Example 3: Required When Another Element is Absent

**Definition:** If ReturnCriteria is not present, then at least one occurrence of SearchCriteria must be present.

```xml
<RuleDefinition>
  <ComplexRule xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="ComplexRule">
    <mustBe>
      <connector>AND</connector>
      <BooleanRule xsi:type="Presence">
        <leftOperand>/SearchCriteria[1]</leftOperand>
      </BooleanRule>
    </mustBe>
    <onCondition>
      <connector>AND</connector>
      <BooleanRule xsi:type="Absence">
        <leftOperand>/ReturnCriteria</leftOperand>
      </BooleanRule>
    </onCondition>
  </ComplexRule>
</RuleDefinition>
```

### Example 4: Value Comparison Rule

**Definition:** If TotalAmount is present, then all occurrences of Item/Amount must have the same currency as the currency of TotalAmount.

```xml
<RuleDefinition>
  <ComplexRule xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="ComplexRule">
    <mustBe>
      <connector>AND</connector>
      <BooleanRule xsi:type="EqualToNode">
        <leftOperand>
          /Item[*]/Amount/@Currency
        </leftOperand>
        <rightOperand>
          /TotalAmount/@Currency
        </rightOperand>
      </BooleanRule>
    </mustBe>
    <onCondition>
      <connector>AND</connector>
      <BooleanRule xsi:type="Presence">
        <leftOperand>
          /TotalAmount
        </leftOperand>
      </BooleanRule>
    </onCondition>
  </ComplexRule>
</RuleDefinition>
```

### Example 5: Comparison with Literal Value

**Definition:** If a field has value DISS, it cannot have value NDISS.

```xml
<BooleanRule xsi:type="DifferentFromValue">
  <leftOperand>
    /OfferType[*]/Code
  </leftOperand>
  <rightOperand>
    DissenterRightsNotApplicable
  </rightOperand>
</BooleanRule>
```

### Example 6: Comparison Between Nodes

**Definition:** InstructedAmount currency must differ from InterbankSettlementAmount currency.

```xml
<BooleanRule xsi:type="DifferentFromNode">
  <leftOperand>
    /InstructedAmount/@Currency
  </leftOperand>
  <rightOperand>
    /InterbankSettlementAmount/@Currency
  </rightOperand>
</BooleanRule>
```

### Example 7: Value Must Be In List

**Definition:** ChequeType must be in the ChequeType3Code list (e.g., DRFT, ELDR).

```xml
<BooleanRule xsi:type="WithInList">
  <leftOperand>
    /ChequeType
  </leftOperand>
  <rightOperand>
    ChequeType3Code
  </rightOperand>
</BooleanRule>
```

### Example 8: Value Must Not Be In List

**Definition:** GroupStatus must not be in the ValidationRulePendingAndRejected1Code list.

```xml
<BooleanRule xsi:type="NotWithInList">
  <leftOperand>
    /GroupStatus
  </leftOperand>
  <rightOperand>
    ValidationRulePendingAndRejected1Code
  </rightOperand>
</BooleanRule>
```

export type Expression = { constant: number; terms: Map<number, number> };
export const constant = (value: number): Expression => ({
  constant: value,
  terms: new Map(),
});
export function plus(...items: Expression[]): Expression {
  const result = constant(0);
  for (const item of items) {
    result.constant += item.constant;
    for (const [id, value] of item.terms)
      result.terms.set(id, (result.terms.get(id) ?? 0) + value);
  }
  for (const [id, value] of result.terms)
    if (value === 0) result.terms.delete(id);
  return result;
}
export const scale = (item: Expression, factor: number): Expression => ({
  constant: item.constant * factor,
  terms: new Map([...item.terms].map(([id, value]) => [id, value * factor])),
});
type Constraint = {
  expression: Expression;
  sense: '<=' | '>=' | '=';
  bound: number;
};
export class ModelSizeLimit extends Error {}

export class LinearModel {
  variables: { binary: boolean; upper: number }[] = [
    { binary: false, upper: 0 },
  ];
  constraints: Constraint[] = [];
  variable(binary = true, upper = 1): Expression {
    if (this.variables.length >= 80_000) throw new ModelSizeLimit();
    const id = this.variables.length;
    this.variables.push({ binary, upper });
    return { constant: 0, terms: new Map([[id, 1]]) };
  }
  constrain(expression: Expression, sense: Constraint['sense'], bound: number) {
    this.constraints.push({ expression, sense, bound });
  }
  or(items: Expression[]): Expression {
    if (items.some((item) => item.terms.size === 0 && item.constant > 0))
      return constant(1);
    const active = items.filter((item) => item.terms.size > 0);
    if (active.length === 0) return constant(0);
    const result = this.variable();
    for (const item of active)
      this.constrain(plus(result, scale(item, -1)), '>=', 0);
    this.constrain(plus(result, scale(plus(...active), -1)), '<=', 0);
    return result;
  }
  positive(item: Expression, upper: number): Expression {
    if (item.terms.size === 0) return constant(Math.max(0, item.constant));
    const result = this.variable(false, upper);
    this.constrain(plus(result, scale(item, -1)), '>=', 0);
    return result;
  }
  text(objective: Expression): string {
    const terms = (item: Expression) =>
      [...item.terms]
        .map(
          ([id, value]) => `${value < 0 ? '-' : '+'} ${Math.abs(value)} v${id}`,
        )
        .join(' ') || '0 v0';
    return [
      'Minimize',
      ` obj: ${terms(objective)}`,
      'Subject To',
      ...this.constraints.map(
        ({ expression, sense, bound }, index) =>
          ` c${index}: ${terms(expression)} ${sense} ${bound - expression.constant}`,
      ),
      'Bounds',
      ...this.variables.map(
        (variable, id) => ` 0 <= v${id} <= ${variable.upper}`,
      ),
      'Binary',
      this.variables
        .flatMap((variable, id) => (variable.binary ? [` v${id}`] : []))
        .join('\n'),
      'End',
    ].join('\n');
  }
}

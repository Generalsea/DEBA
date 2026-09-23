export type CheckoutStepId = 'address' | 'delivery' | 'payment' | 'review'
export function CheckoutSteps({ steps, currentStep }: { steps: { id: CheckoutStepId; label: string }[]; currentStep: CheckoutStepId }) {
  const index = steps.findIndex((step) => step.id === currentStep)
  return <nav className="deba-checkout-steps" aria-label="خطوات إتمام الشراء">{steps.map((step, i) => <div key={step.id} className={'deba-checkout-step' + (i === index ? ' is-active' : '') + (i < index ? ' is-completed' : '')}><span>{i < index ? '✓' : i + 1}</span><strong>{step.label}</strong></div>)}</nav>
}
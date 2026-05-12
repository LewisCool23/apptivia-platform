/**
 * Opens Aaron chatbot with a pre-seeded prompt.
 * Uses a custom DOM event so any component can trigger it
 * without prop drilling through DashboardLayout.
 */
export function openAaronWithPrompt(prompt: string) {
  window.dispatchEvent(new CustomEvent('open-aaron', { detail: { prompt } }));
}

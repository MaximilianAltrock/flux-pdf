import { createApp, type Component } from 'vue'

export function mountVueComponent(
  component: Component,
  props: Record<string, unknown> = {},
) {
  const host = document.createElement('div')
  document.body.appendChild(host)

  const app = createApp(component, props)
  app.mount(host)

  return {
    host,
    unmount() {
      app.unmount()
      host.remove()
    },
  }
}

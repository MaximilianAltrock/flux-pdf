import { liveQuery } from 'dexie'
import { onScopeDispose, shallowRef } from 'vue'

export interface LiveProjectListObserver<T> {
  next(items: ReadonlyArray<T>): void
  error(error: unknown): void
}

export interface LiveProjectListSubscriber<T> {
  subscribe(
    load: () => Promise<ReadonlyArray<T>>,
    observer: LiveProjectListObserver<T>,
  ): { unsubscribe(): void }
}

function createDefaultSubscriber<T>(): LiveProjectListSubscriber<T> {
  return {
    subscribe(load, observer) {
      return liveQuery(load).subscribe(observer)
    },
  }
}

export function useLiveProjectList<T>(
  load: () => Promise<ReadonlyArray<T>>,
  options?: {
    onError?: (error: unknown) => void
    subscriber?: LiveProjectListSubscriber<T>
  },
) {
  const items = shallowRef<T[]>([])
  const isLoading = shallowRef(true)
  const subscriber = options?.subscriber ?? createDefaultSubscriber<T>()

  async function reloadFallback(): Promise<void> {
    try {
      items.value = [...(await load())]
    } finally {
      isLoading.value = false
    }
  }

  const subscription = subscriber.subscribe(load, {
    next(nextItems) {
      items.value = [...nextItems]
      isLoading.value = false
    },
    error(error) {
      options?.onError?.(error)
      void reloadFallback()
    },
  })

  onScopeDispose(() => {
    subscription.unsubscribe()
  })

  return {
    items,
    isLoading,
  }
}

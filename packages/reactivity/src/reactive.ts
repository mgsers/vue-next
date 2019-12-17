import { isObject, toTypeString } from '@vue/shared'
import { mutableHandlers, readonlyHandlers } from './baseHandlers'

import {
  mutableCollectionHandlers,
  readonlyCollectionHandlers
} from './collectionHandlers'

import { UnwrapNestedRefs } from './ref'
import { ReactiveEffect } from './effect'

// The main WeakMap that stores {target -> key -> dep} connections.
// Conceptually, it's easier to think of a dependency as a Dep class
// which maintains a Set of subscribers, but we simply store them as
// raw Sets to reduce memory overhead.
export type Dep = Set<ReactiveEffect>
export type KeyToDepMap = Map<string | symbol, Dep>
// 相当Dep类，用以进行观察监听，一层Map，一层Set结构
export const targetMap = new WeakMap<any, KeyToDepMap>()

// WeakMaps that store {raw <-> observed} pairs.
// 储存原对象与代理对象的关系集合 键：原对象 值：代理对象
const rawToReactive = new WeakMap<any, any>()
// 储存原对象与代理对象的关系集合 键：代理对象 值：原对象
const reactiveToRaw = new WeakMap<any, any>()
// 只读数据保存
const rawToReadonly = new WeakMap<any, any>()
const readonlyToRaw = new WeakMap<any, any>()

// WeakSets for values that are marked readonly or non-reactive during
// observable creation.
const readonlyValues = new WeakSet<any>()
const nonReactiveValues = new WeakSet<any>()
// 储存构造函数
const collectionTypes = new Set<Function>([Set, Map, WeakMap, WeakSet])
// 监听数据类型正则表达式
const observableValueRE = /^\[object (?:Object|Array|Map|Set|WeakMap|WeakSet)\]$/
// 能否被代理的白名单
const canObserve = (value: any): boolean => {
  return (
    // 不是vue实例
    !value._isVue &&
    // 不是虚拟dom
    !value._isVNode &&
    // （Object|Array|Map|Set|WeakMap|WeakSet）这几种类型
    observableValueRE.test(toTypeString(value)) &&
    // 其他一些不能代理集合
    !nonReactiveValues.has(value)
  )
}

export function reactive<T extends object>(target: T): UnwrapNestedRefs<T>
// 监听函数
export function reactive(target: object) {
  // if trying to observe a readonly proxy, return the readonly version.
  // 如果是只读数据，则直接返回
  if (readonlyToRaw.has(target)) {
    return target
  }
  // target is explicitly marked as readonly by user
  // 如果被明确表明只读，则
  if (readonlyValues.has(target)) {
    return readonly(target)
  }
  return createReactiveObject(
    target,
    rawToReactive,
    reactiveToRaw,
    mutableHandlers,
    mutableCollectionHandlers
  )
}

export function readonly<T extends object>(
  target: T
): Readonly<UnwrapNestedRefs<T>>
export function readonly(target: object) {
  // value is a mutable observable, retrieve its original and return
  // a readonly version.
  // 如果是只读数据，则直接返回
  if (reactiveToRaw.has(target)) {
    target = reactiveToRaw.get(target)
  }
  return createReactiveObject(
    target,
    rawToReadonly,
    readonlyToRaw,
    readonlyHandlers,
    readonlyCollectionHandlers
  )
}

function createReactiveObject(
  target: any,
  toProxy: WeakMap<any, any>,
  toRaw: WeakMap<any, any>,
  baseHandlers: ProxyHandler<any>,
  collectionHandlers: ProxyHandler<any>
) {
  // 如果不是对象，则直接返回
  if (!isObject(target)) {
    if (__DEV__) {
      console.warn(`value cannot be made reactive: ${String(target)}`)
    }
    return target
  }
  // 对象已经具有相应的代理
  // target already has corresponding Proxy
  let observed = toProxy.get(target)
  if (observed !== void 0) {
    return observed
  }
  // 对象已经代理过了，则直接返回
  // target is already a Proxy
  if (toRaw.has(target)) {
    return target
  }
  // 在白名单内的类型值才能够被代理，否则直接返回
  // only a whitelist of value types can be observed.
  if (!canObserve(target)) {
    return target
  }
  // 如果目标为（Set, Map, WeakMap, WeakSet）则使用collectionHandlers代理器
  // 如果不是，则使用baseHandlers
  const handlers = collectionTypes.has(target.constructor)
    ? collectionHandlers
    : baseHandlers
  // 正式代理
  observed = new Proxy(target, handlers)
  // 将代理过的加入到Map，键：原目标 值：代理后的对象
  toProxy.set(target, observed)
  // 将代理过的加入到Map，键：代理后的对象 值：原目标
  toRaw.set(observed, target)
  // 如果（Dep类）没有该目标对象，则把目标对象加进此类
  if (!targetMap.has(target)) {
    targetMap.set(target, new Map())
  }
  // 返回代理对象
  return observed
}
// 判断对象是否已经被代理
export function isReactive(value: any): boolean {
  return reactiveToRaw.has(value) || readonlyToRaw.has(value)
}
// 判断对象是否已经被代理（只读）
export function isReadonly(value: any): boolean {
  return readonlyToRaw.has(value)
}
// 获取代理对象相应的原对象
export function toRaw<T>(observed: T): T {
  return reactiveToRaw.get(observed) || readonlyToRaw.get(observed) || observed
}
// 将目标标记为只读
export function markReadonly<T>(value: T): T {
  readonlyValues.add(value)
  return value
}
// 将目标标记为不为代理
export function markNonReactive<T>(value: T): T {
  nonReactiveValues.add(value)
  return value
}

import { track, trigger } from './effect'
import { OperationTypes } from './operations'
import { isObject } from '@vue/shared'
import { reactive } from './reactive'

export const refSymbol = Symbol(__DEV__ ? 'refSymbol' : undefined)

export interface Ref<T> {
  [refSymbol]: true
  value: UnwrapNestedRefs<T>
}
// ref类型一般用于简单数据结构数据进行数据监听管理
export type UnwrapNestedRefs<T> = T extends Ref<any> ? T : UnwrapRef<T>
// 工具 - 转化为监听对象
const convert = (val: any): any => (isObject(val) ? reactive(val) : val)
// 将数据加工为监听对象
export function ref<T>(raw: T): Ref<T> {
  raw = convert(raw)
  const v = {
    [refSymbol]: true,
    get value() {
      // 手动添加数据监听，并把他放在空字符串所保存的Set内储存
      track(v, OperationTypes.GET, '')
      return raw
    },
    set value(newVal) {
      // 将新的数据进行监听，不走proxy set流程
      raw = convert(newVal)
      // 触发
      trigger(v, OperationTypes.SET, '')
    }
  }
  return v as Ref<T>
}
// 是否为 ref 类型数据
export function isRef(v: any): v is Ref<any> {
  return v ? v[refSymbol] === true : false
}
// 将对象转化为ref类型
export function toRefs<T extends object>(
  object: T
): { [K in keyof T]: Ref<T[K]> } {
  const ret: any = {}
  for (const key in object) {
    ret[key] = toProxyRef(object, key)
  }
  return ret
}

function toProxyRef<T extends object, K extends keyof T>(
  object: T,
  key: K
): Ref<T[K]> {
  const v = {
    [refSymbol]: true,
    get value() {
      return object[key]
    },
    set value(newVal) {
      object[key] = newVal
    }
  }
  return v as Ref<T[K]>
}

type BailTypes =
  | Function
  | Map<any, any>
  | Set<any>
  | WeakMap<any, any>
  | WeakSet<any>

// Recursively unwraps nested value bindings.
export type UnwrapRef<T> = {
  ref: T extends Ref<infer V> ? UnwrapRef<V> : T
  array: T extends Array<infer V> ? Array<UnwrapRef<V>> : T
  object: { [K in keyof T]: UnwrapRef<T[K]> }
  stop: T
}[T extends Ref<any>
  ? 'ref'
  : T extends Array<any>
    ? 'array'
    : T extends BailTypes
      ? 'stop' // bail out on types that shouldn't be unwrapped
      : T extends object ? 'object' : 'stop']

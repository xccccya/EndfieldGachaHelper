/**
 * 全局交互锁定（用于长耗时任务期间阻止误触）
 *
 * 设计目标：
 * - 锁定时覆盖全局 UI，阻止点击/导航等交互
 * - 提供可选的“取消/中止”能力（由调用方注入回调）
 * - 使用 useSyncExternalStore，避免 Context 级联渲染
 */

import { useSyncExternalStore } from 'react';

export type InteractionLockSnapshot = {
  locked: boolean;
  /** i18n key（优先），例如：'sync.lockTitle' */
  titleKey?: string;
  title?: string;
  descriptionKey?: string;
  description?: string;
  /** 用于展示当前阶段/进度等信息 */
  detailLines?: string[];
  cancelLabelKey?: string;
  cancelLabel?: string;
  cancelling?: boolean;
  onCancel?: (() => void) | undefined;
};

type Listener = () => void;

let snapshot: InteractionLockSnapshot = { locked: false };
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

export function subscribeInteractionLock(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getInteractionLockSnapshot() {
  return snapshot;
}

export function lockInteraction(next: Omit<InteractionLockSnapshot, 'locked'>) {
  snapshot = { locked: true, ...next };
  emit();
}

export function updateInteractionLock(partial: Partial<Omit<InteractionLockSnapshot, 'locked'>>) {
  if (!snapshot.locked) return;
  snapshot = { ...snapshot, ...partial, locked: true };
  emit();
}

export function unlockInteractionLock() {
  if (!snapshot.locked) return;
  snapshot = { locked: false };
  emit();
}

export function useInteractionLock() {
  return useSyncExternalStore(
    subscribeInteractionLock,
    getInteractionLockSnapshot,
    getInteractionLockSnapshot,
  );
}


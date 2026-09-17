"use client";

/**
 * Web MIDI 真琴输入 hook（#43；tech-selection §3.2「原生 requestMIDIAccess + 自写 hook」首选方案）：
 * 零第三方依赖；noteon 归一为统一作答事件源，noteoff 解析但不入作答流（虚拟钢琴同样只取按下）。
 *
 * 降级矩阵（tech-selection §3.1，AC5/AC6）：
 * - Safari / iOS（无 Web MIDI，Apple 明确拒绝实现）：status = "unsupported"，
 *   静默回退仅虚拟钢琴——不报错、不打扰（虚拟钢琴是一等公民）；
 * - Firefox 108+：可用，但首连需按浏览器提示安装/授权「Site Permission Add-On」，
 *   引导文案由消费方按 status = "prompting" + UA 检测展示（PracticeStage 状态行）；
 * - Chrome / Edge：全功能，首次弹权限提示。
 *
 * 手势约束（AC4）：requestAccess() 必须在用户手势回调内调用——
 * 训练「开始」按钮里与 Tone.start() 绑定同一手势。
 *
 * SSR 安全：navigator 仅在 effect / 手势回调内触达，渲染路径不读浏览器 API
 * （tech-selection §4「客户端边界」；特性检测放 mount effect，避免 hydration 不一致）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { parseMidiMessage } from "@/lib/midi/parse";
import type { MidiNoteEvent, MidiStageBridge } from "@/lib/midi/types";

export type MidiAccessStatus =
  | "unsupported" // 浏览器无 Web MIDI（Safari/iOS）——静默仅虚拟钢琴
  | "idle" // 尚未请求（等待「开始」按钮手势）
  | "prompting" // requestMIDIAccess 进行中（权限弹窗 / Firefox 附加组件授权）
  | "granted" // 已授权；是否有输入设备见 connected
  | "denied"; // 被拒绝或不可用——虚拟钢琴照常，不视为错误

export type MidiInputApi = {
  status: MidiAccessStatus;
  /** 真琴已接入：已授权且存在输入设备；热插拔自动更新。true 时题面关闭作答发声（ADR 0005）。 */
  connected: boolean;
  /** 已连接输入设备名（状态行展示用）。 */
  inputNames: readonly string[];
  /** 在用户手势内请求 MIDI 权限（幂等：已授权/进行中不重复弹窗）。 */
  requestAccess: () => void;
  /** 题面组件消费的桥接（透传为 QuestionStageProps.midi）。 */
  bridge: MidiStageBridge;
};

/** 当前浏览器是否支持 Web MIDI（只能在客户端调用路径使用；SSR 下恒 false）。 */
function midiSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.requestMIDIAccess === "function";
}

export function useMidiInput(): MidiInputApi {
  const [status, setStatus] = useState<MidiAccessStatus>("idle");
  const [inputNames, setInputNames] = useState<readonly string[]>([]);

  const accessRef = useRef<MIDIAccess | null>(null);
  const requestingRef = useRef(false);
  /** noteon 订阅者（题面组件经 bridge.subscribeNoteOn 注册）；跨 bridge 重建存活。 */
  const listenersRef = useRef<Set<(note: MidiNoteEvent) => void>>(new Set());

  // 特性检测放 mount effect：首帧不读 navigator，SSR/hydration 安全；
  // 无 Web MIDI 的浏览器（Safari/iOS）落到 "unsupported"，全程无报错（AC5）。
  useEffect(() => {
    if (!midiSupported()) {
      setStatus((s) => (s === "idle" ? "unsupported" : s));
    }
  }, []);

  const handleMessage = useCallback((event: MIDIMessageEvent) => {
    if (!event.data) return; // 规范允许 data 为 null（异常消息），静默丢弃
    const message = parseMidiMessage(event.data);
    if (message?.command !== "noteon") return; // noteoff/其余消息不入作答流
    const note: MidiNoteEvent = {
      midi: message.note,
      velocity: message.velocity,
      // 回调执行时刻即事件时间（与虚拟钢琴 pointerdown 取 performance.now() 同口径；
      // 旧草案的 receivedTime 已从 Web MIDI 标准类型移除，回调延迟毫秒级、统计无感）。
      timestamp: performance.now(),
    };
    listenersRef.current.forEach((listener) => listener(note));
  }, []);

  /** 给全部输入口挂消息回调并刷新设备名单：首次授权与热插拔 statechange 共用（AC1）。 */
  const syncInputs = useCallback(
    (access: MIDIAccess) => {
      const names: string[] = [];
      access.inputs.forEach((input) => {
        input.onmidimessage = handleMessage;
        if (input.state === "connected") names.push(input.name ?? "MIDI 设备");
      });
      setInputNames(names);
    },
    [handleMessage],
  );

  const requestAccess = useCallback(() => {
    if (!midiSupported()) {
      setStatus("unsupported");
      return;
    }
    if (accessRef.current || requestingRef.current) return; // 幂等：不重复弹权限
    requestingRef.current = true;
    setStatus("prompting");
    navigator
      .requestMIDIAccess()
      .then((access) => {
        accessRef.current = access;
        syncInputs(access);
        access.onstatechange = () => syncInputs(access); // 热插拔：重挂回调 + 刷新名单
        setStatus("granted");
      })
      .catch(() => setStatus("denied"))
      .finally(() => {
        requestingRef.current = false;
      });
  }, [syncInputs]);

  // 卸载摘除全部回调（页面跳转 / 热更新防泄漏）。
  useEffect(
    () => () => {
      const access = accessRef.current;
      if (!access) return;
      access.onstatechange = null;
      access.inputs.forEach((input) => {
        input.onmidimessage = null;
      });
      accessRef.current = null;
    },
    [],
  );

  const subscribeNoteOn = useCallback((listener: (note: MidiNoteEvent) => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const connected = status === "granted" && inputNames.length > 0;
  const bridge = useMemo<MidiStageBridge>(
    () => ({ connected, subscribeNoteOn }),
    [connected, subscribeNoteOn],
  );

  return { status, connected, inputNames, requestAccess, bridge };
}

import type { Metadata } from "next";

import PlaygroundClient from "./PlaygroundClient";

export const metadata: Metadata = {
  title: "Playground · 发声层与共享交互组件（#36）",
};

export default function PlaygroundPage() {
  return <PlaygroundClient />;
}

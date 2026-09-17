/**
 * SQL 迁移，按 id 顺序应用（见 migrate.ts）。
 *
 * 刻意内嵌在 TS 里而不是独立 .sql 文件：Next standalone 产物
 * （Dockerfile 只 COPY .next/standalone）不含任意目录，内嵌保证
 * dev / Docker / vitest 三种运行时无需文件系统即可迁移。
 *
 * Schema 只有运行数据四实体（ADR 0006）：无 Problem / Technique / Level 表，
 * 技巧与关卡定义由代码 manifest 持有，这里以 techniqueId / levelId 字符串引用。
 */

export type Migration = {
  id: string;
  sql: string;
};

export const migrations: readonly Migration[] = [
  {
    id: "0001_init",
    sql: `
-- 首版 seed 单用户（ADR 0006：userId 列留多用户余量，其余设施不建）
create table if not exists users (
  id text primary key,
  display_name text not null,
  created_at timestamptz not null default now()
);

insert into users (id, display_name) values ('default', '琴童')
  on conflict (id) do nothing;

-- 轮次：每轮一条，仅结算轮落库（中途放弃不留痕，无"进行中"状态）。
-- 行上反规范化快照当轮参数（题型、题数、阈值、时限值）：
-- 插件日后调参不使历史统计口径漂移。
create table if not exists practice_session (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users (id),
  technique_id text not null,
  level_id text not null,
  -- 当轮参数快照
  question_type text not null,
  question_count integer not null check (question_count > 0),
  min_accuracy double precision not null check (min_accuracy >= 0 and min_accuracy <= 1),
  max_median_response_ms integer check (max_median_response_ms > 0),
  time_limit_ms integer check (time_limit_ms > 0),
  -- 结算结果（判定在客户端，服务端只持久化）
  passed boolean not null,
  correct_count integer not null check (correct_count >= 0),
  accuracy double precision not null check (accuracy >= 0 and accuracy <= 1),
  median_response_ms integer not null check (median_response_ms >= 0),
  settled_at timestamptz not null default now(),
  check (correct_count <= question_count)
);

create index if not exists practice_session_user_level_idx
  on practice_session (user_id, technique_id, level_id);

-- 关卡进度：passed 永久单调 + best 结算时刻快照（不随关卡参数调整漂移）。
-- 毕业 / 解锁 / 排行榜均为派生查询，不落库（此处只存 passed 与 best 两个事实）。
create table if not exists level_progress (
  user_id text not null references users (id),
  technique_id text not null,
  level_id text not null,
  passed boolean not null default false,
  best_session_id uuid references practice_session (id),
  best_correct_count integer,
  best_question_count integer,
  best_accuracy double precision,
  best_median_response_ms integer,
  best_achieved_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, technique_id, level_id)
);

-- 作答记录：题目 JSONB 特征快照 + 用户作答 + 对错 + 响应 ms。
-- 特征即数据：未来 SR / 自适应 / 错题特征聚合直接在其上做聚合，无需 schema 变更。
create table if not exists answer_record (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references practice_session (id) on delete cascade,
  user_id text not null references users (id),
  position integer not null check (position > 0),
  question jsonb not null,
  answer jsonb,
  ok boolean not null,
  response_ms integer not null check (response_ms >= 0),
  timed_out boolean not null default false
);

create index if not exists answer_record_session_idx
  on answer_record (session_id, position);
create index if not exists answer_record_user_idx
  on answer_record (user_id);
`,
  },
];

import { Fragment } from "react";
import StageNode from "./StageNode";
import UploadNode from "./UploadNode";

// Flex-1 connector
function FlexConnector({ animated, noArrow = false }) {
  return (
    <div className="flex items-center flex-1 min-w-4 shrink self-start mt-12">
      <div className={`h-px flex-1 transition-colors duration-300 ${animated ? "bg-blue-400 flow-pulse" : "bg-slate-300"}`} />
      {!noArrow && <div className={`connector-arrow-sm transition-colors duration-300 ${animated ? "active-sm" : "neutral-sm"}`} />}
    </div>
  );
}

// Terminal node geometry constants (must match StageNode compact layout)
const NODE_H        = 136; // approx height of a terminal node (circle+label+sublabel)
const GAP           = 32;  // gap-8
const CIRCLE_CENTER = 48;  // w-24/h-24 circle → centre at 48px from node top

// Fork connector SVG.
// The main flow line arrives at y = CIRCLE_CENTER (its mt-12 offset).
// We need the spine to connect there, so the middle arm is drawn from x=0
// (seamless with the incoming FlexConnector) while the other arms start at the spine (x=1).
function ForkConnector({ count, midIdx }) {
  const centers = Array.from({ length: count }, (_, i) => CIRCLE_CENTER + i * (NODE_H + GAP));
  const W    = 32;
  const svgH = centers[count - 1] + NODE_H / 2 + 16;

  return (
    <div className="self-start shrink-0" style={{ width: W }}>
      <svg width={W} height={svgH} className="overflow-visible">
        {/* Vertical spine: top node centre → bottom node centre */}
        {count > 1 && (
          <line x1="1" y1={centers[0]} x2="1" y2={centers[count - 1]}
                stroke="#cbd5e1" strokeWidth="1" />
        )}
        {centers.map((cy, i) => (
          <g key={i}>
            {/* Middle arm starts at x=0 to connect flush with incoming FlexConnector */}
            <line
              x1={i === midIdx ? 0 : 1} y1={cy} x2={W} y2={cy}
              stroke="#cbd5e1" strokeWidth="1"
            />
            <polyline
              points={`${W - 6},${cy - 4} ${W},${cy} ${W - 6},${cy + 4}`}
              fill="none" stroke="#cbd5e1" strokeWidth="1"
              strokeLinecap="round" strokeLinejoin="round"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

const TERMINAL_ORDER = ["Won", "Nurture", "Lost"];

export default function PipelineFlow({
  columns, rules, running, completed, totalLeads,
  runningStageId, completedStageIds,
  uploadCompleted,
  onAddRule, onEditRule, onDeleteRule, onUpload, onResetUpload, onRunStage, onFlushStage,
}) {
  const rulesByStage = {};
  (rules || []).forEach((r) => {
    if (!rulesByStage[r.target_stage_id]) rulesByStage[r.target_stage_id] = [];
    rulesByStage[r.target_stage_id].push(r);
  });

  if (!columns?.length) return null;

  const terminalNames  = new Set(TERMINAL_ORDER);
  const mainStages     = columns.filter((c) => !terminalNames.has(c.stage.name) && c.stage.name !== "New");
  const terminalStages = TERMINAL_ORDER.map((n) => columns.find((c) => c.stage.name === n)).filter(Boolean);

  // Centre the main flow on the middle terminal node so the pipeline sits at
  // the visual midpoint of the fork column.
  const midIdx         = Math.floor(terminalStages.length / 2);
  const midCircleY     = CIRCLE_CENTER + midIdx * (NODE_H + GAP); // y of mid node centre in fork col
  const mainFlowMargin = midCircleY - CIRCLE_CENTER;              // push main flow down by this much

  return (
    <div className="w-full flex items-start overflow-x-auto pb-4">

      {/* Main pipeline — offset so its circle line aligns with the middle fork arm */}
      <div className="flex flex-1 items-start" style={{ marginTop: mainFlowMargin }}>
        <div className="shrink-0">
          <UploadNode
            onClick={onUpload}
            leadCount={totalLeads ?? 0}
            uploadCompleted={uploadCompleted}
            onReset={onResetUpload}
          />
        </div>

        <FlexConnector animated={false} />

        {mainStages.map((col, i) => {
          const isLast = i === mainStages.length - 1;
          return (
            <Fragment key={col.stage.id}>
              <div className="shrink-0">
                <StageNode
                  stage={col.stage}
                  leadCount={col.total}
                  rules={rulesByStage[col.stage.id] || []}
                  isEntry={false}
                  isTerminal={false}
                  running={running}
                  completed={completed}
                  onAddRule={onAddRule}
                  onEditRule={onEditRule}
                  onDeleteRule={onDeleteRule}
                  onRun={onRunStage}
                  onFlush={onFlushStage}
                  stageRunning={runningStageId === col.stage.id}
                  stageCompleted={completedStageIds?.has(col.stage.id)}
                />
              </div>
              {!isLast && <FlexConnector animated={running} />}
            </Fragment>
          );
        })}

        {terminalStages.length > 0 && <FlexConnector animated={false} noArrow />}
      </div>

      {/* Fork + parallel terminal outcomes — anchored to top of container */}
      {terminalStages.length > 0 && (
        <>
          <ForkConnector count={terminalStages.length} midIdx={midIdx} />
          <div className="flex flex-col shrink-0 self-start" style={{ gap: GAP }}>
            {terminalStages.map((col) => (
              <div key={col.stage.id} className="shrink-0">
                <StageNode
                  stage={col.stage}
                  leadCount={col.total}
                  rules={[]}
                  isEntry={false}
                  isTerminal={true}
                  running={false}
                  completed={false}
                  stageRunning={false}
                  stageCompleted={false}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

import { Fragment } from "react";
import StageNode from "./StageNode";
import UploadNode from "./UploadNode";

// Flex-1 connector — expands to fill space, never causes overflow
function FlexConnector({ animated }) {
  return (
    <div className="flex items-center flex-1 min-w-4 shrink self-start mt-12">
      <div className={`h-px flex-1 transition-colors duration-300 ${animated ? "bg-blue-400 flow-pulse" : "bg-slate-300"}`} />
      <div className={`connector-arrow-sm transition-colors duration-300 ${animated ? "active-sm" : "neutral-sm"}`} />
    </div>
  );
}

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

  // "New" stage is merged into the UploadNode — skip it in the flow
  const mainStages = columns.filter((c) => !["New", "Won", "Lost"].includes(c.stage.name));
  const wonCol     = columns.find((c) => c.stage.name === "Won");
  const lostCol    = columns.find((c) => c.stage.name === "Lost");

  const terminalStages = [wonCol, lostCol].filter(Boolean);
  const allStages = [...mainStages, ...terminalStages];

  return (
    <div className="w-full flex items-start overflow-x-hidden">

      {/* Import / Upload node — merged with "Imported" count */}
      <div className="shrink-0">
        <UploadNode
          onClick={onUpload}
          leadCount={totalLeads ?? 0}
          uploadCompleted={uploadCompleted}
          onReset={onResetUpload}
        />
      </div>

      <FlexConnector animated={false} />

      {allStages.map((col, i) => {
        const isEntry    = false;
        const isTerminal = ["Won", "Lost"].includes(col.stage.name);
        const isLast     = i === allStages.length - 1;

        return (
          <Fragment key={col.stage.id}>
            <div className="shrink-0">
              <StageNode
                stage={col.stage}
                leadCount={col.total}
                rules={rulesByStage[col.stage.id] || []}
                isEntry={isEntry}
                isTerminal={isTerminal}
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
            {!isLast && <FlexConnector animated={running && !isTerminal} />}
          </Fragment>
        );
      })}
    </div>
  );
}

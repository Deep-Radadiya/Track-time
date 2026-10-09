import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Task } from "@/types/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Edit2,
  Trash,
  Keyboard,
  Mic,
  ChevronDown,
  ChevronUp,
  Calendar,
  MessageSquare,
} from "lucide-react";
import { useTaskAction, useDeleteTask } from "@/hooks/useTasks";
import { TaskEditModal } from "./TaskEditModal";
import { formatDueDate, isReminderOn } from "@/lib/utils";

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const navigate = useNavigate();

  const actionMutation = useTaskAction();
  const deleteMutation = useDeleteTask();

  const handleAction = (action: string, snoozeMins?: number) => {
    actionMutation.mutate({
      id: task.id,
      data: {
        action,
        client_timestamp: new Date().toISOString(),
        snooze_minutes: snoozeMins,
      },
    });
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this task?")) {
      deleteMutation.mutate(task.id);
    }
  };

  const hasNotes = task.notes && task.notes.length > 0;
  const isOn = isReminderOn(task);

  return (
    <motion.div
      layout
      className={`glass-card p-3.5 flex flex-col justify-between gap-2.5 transition-all duration-200 ${isOn ? "" : "opacity-60"}`}
    >
      <div className="flex justify-between items-start gap-4">
        <div className="space-y-1 select-none flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3
              className="text-base font-semibold text-text-primary truncate"
            >
              {task.title}
            </h3>
            {task.source === "voice" ? (
              <span title="Voice Input">
                <Mic size={14} className="text-accent shrink-0" />
              </span>
            ) : (
              <span title="Text Input">
                <Keyboard size={14} className="text-text-muted shrink-0" />
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap text-xs text-text-secondary pt-0.5">
            {task.category && (
              <span className="bg-ink/5 border border-border rounded px-1.5 py-0.5 text-text-secondary uppercase tracking-wider text-[10px] font-bold">
                {task.category}
              </span>
            )}
            {task.recurrence !== "none" && (
              <span className="text-primary font-medium">
                ↻ {task.recurrence}
                {task.recurrence === "interval" &&
                  ` (${task.interval_minutes}m)`}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* The on/off switch. Off "blocks" the reminder on the server; on "reopens" it. */}
          <button
            role="switch"
            aria-checked={isOn}
            aria-label={isOn ? "Turn reminder off" : "Turn reminder on"}
            onClick={() => handleAction(isOn ? "block" : "reopen")}
            disabled={actionMutation.isPending}
            className={`relative w-9 h-5 rounded-full transition-colors duration-200 disabled:opacity-60 ${isOn ? "bg-primary" : "bg-ink/20"}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${isOn ? "translate-x-4" : ""}`}
            />
          </button>
          <button
            onClick={() => setIsEditOpen(true)}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-ink/5 transition-all"
            title="Edit Task"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 rounded-lg text-text-secondary hover:text-danger hover:bg-danger/10 transition-all"
            title="Delete Task"
            disabled={deleteMutation.isPending}
          >
            <Trash size={16} />
          </button>
        </div>
      </div>

      {/* When the next reminder will go off */}
      {task.next_due_at && (
        <div className="flex items-center gap-1.5 text-xs text-text-secondary select-none">
          <Calendar size={14} className="text-text-muted" />
          <span>Next reminder: {formatDueDate(task.next_due_at)}</span>
        </div>
      )}

      {/* Notes collapsible list */}
      {hasNotes && (
        <div className="border-t border-border/30 pt-2 mt-1">
          <button
            onClick={() => setNotesExpanded(!notesExpanded)}
            className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-all mb-1 font-medium"
          >
            {notesExpanded ? (
              <ChevronUp size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
            <span>Notes ({task.notes.length})</span>
          </button>

          <AnimatePresence initial={false}>
            {notesExpanded && (
              <motion.ul
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-1 pl-1"
              >
                {task.notes.map((note) => (
                  <li
                    key={note.id}
                    className="text-xs text-text-secondary flex items-start gap-2 py-0.5"
                  >
                    <span className="text-text-muted mt-1 select-none">•</span>
                    <span
                      className={
                        note.done ? "line-through text-text-muted" : ""
                      }
                    >
                      {note.text}
                    </span>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border/20 pt-3">
        <span
          className={`text-xs font-semibold ${isOn ? "text-primary" : "text-text-muted"}`}
        >
          {isOn ? "On" : "Off"}
        </span>
        <button
          onClick={() => navigate(`/update/${task.id}`)}
          className="btn-ghost py-1 px-2.5 text-xs font-semibold flex items-center gap-1 text-text-secondary hover:text-text-primary"
          title="Write an update for this reminder"
        >
          <MessageSquare size={12} />
          Add update
        </button>
      </div>

      <TaskEditModal
        open={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        task={task}
      />
    </motion.div>
  );
}

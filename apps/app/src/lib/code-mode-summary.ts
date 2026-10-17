import type { DynamicToolUIPart } from "ai";
import { getCapabilityCallSentence } from "./capability-call";
import { t } from "../i18n";

/** Object of a create/save call, phrased the way the sentence needs it. */
const OBJECT_KEYS: Record<string, string> = {
  issue: "status.cmd_object_issue",
  note: "status.cmd_object_note",
  task: "status.cmd_object_task",
  document: "status.cmd_object_document",
};

/** A summary of the work, not a mirror of whichever child happened to run last. */
export function codeModeSummary(
  calls: DynamicToolUIPart[],
  options: {
    running: boolean;
    failed: boolean;
    serviceName: (call: DynamicToolUIPart) => string | null;
  },
): string {
  const failedCalls = calls.filter((call) => call.state === "output-error");
  // A finished script whose every call failed did not "look up" anything,
  // even when the engine reports the script itself as completed.
  const allFailed = !options.running && calls.length > 0 && failedCalls.length === calls.length;
  if (options.failed || allFailed) {
    // Name what failed when one call did ("Script on OpenWork Cloud failed").
    const only = failedCalls.length === 1 ? failedCalls[0] : undefined;
    const failure = only ? getCapabilityCallSentence(only, { connectionName: options.serviceName(only), includeQuery: false }).failure : undefined;
    return failure ?? t("status.cmd_script_failed");
  }
  if (calls.length === 0) return options.running ? t("status.cmd_script_running") : t("status.cmd_script_ran");

  const changes = calls.filter((call) => {
    const name = call.toolName.endsWith("_execute_capability") && typeof call.input === "object" && call.input !== null && "name" in call.input
      ? call.input.name : call.toolName;
    if (typeof name !== "string") return false;
    const action = name.split(/[.:/]/).at(-1) ?? "";
    return /(?:^|_)(create|save|add|send|post|update|edit|write|delete|remove|publish|move|rename)(?:_|[A-Z]|$)/i.test(action);
  });
  if (changes.length === 1) {
    const call = changes[0]!;
    const sentence = getCapabilityCallSentence(call, { connectionName: options.serviceName(call), includeQuery: false });
    const label = options.running && (call.state === "input-available" || call.state === "input-streaming") ? sentence.present : sentence.past;
    // A successful write is more informative than a later read. Don't report
    // success for a write the engine says failed.
    if (call.state !== "output-error") {
      const service = options.serviceName(call);
      const input = typeof call.input === "object" && call.input !== null ? call.input : null;
      const raw = input && "name" in input && typeof input.name === "string" ? input.name : call.toolName;
      const action = raw.split(/[.:/]/).at(-1) ?? "";
      const creating = options.running && (call.state === "input-available" || call.state === "input-streaming");
      const body = input && "body" in input && typeof input.body === "object" && input.body !== null ? input.body : null;
      if (/(?:^|_)save_issue$/.test(action)) {
        const updating = body && "id" in body && typeof body.id === "string" && body.id.length > 0;
        const object = t("status.cmd_object_issue");
        return service
          ? t(creating ? "status.cmd_object_updating_service" : "status.cmd_object_updated_service", { object, service })
          : t(creating ? "status.cmd_object_updating" : "status.cmd_object_updated", { object });
      }
      if (/(?:^|_)create_(issue|note|task|document)$/.test(action)) {
        const subject = action.split("_").at(-1) ?? "";
        const objectKey = OBJECT_KEYS[subject] ?? "status.cmd_object_document";
        const object = t(objectKey);
        return service
          ? t(creating ? "status.cmd_object_creating_service" : "status.cmd_object_created_service", { object, service })
          : t(creating ? "status.cmd_object_creating" : "status.cmd_object_created", { object });
      }
      return service && !label.includes(service) ? t("status.cmd_label_in_service", { label, service }) : label;
    }
  }

  const services = [...new Set(calls.map(options.serviceName).filter((name): name is string => Boolean(name)))];
  const names = services.length > 2
    ? t("status.cmd_services_and_others", { names: services.slice(0, 2).join(t("activity.list_separator")) })
    : services.length === 2
      ? t("status.cmd_services_and", { first: services[0]!, second: services[1]! })
      : services.join(" and ");
  if (changes.length > 0) {
    const target = names || t("status.cmd_connected_services");
    return options.running
      ? t("status.cmd_changing_services", { names: target })
      : changes.every((call) => call.state === "output-error")
        ? t("status.cmd_tried_change_services", { names: target })
        : t("status.cmd_changed_services", { names: target });
  }
  // A group of searches says so ("Searched Exa"), not a vague "Looked up".
  // The prefix comes from the same catalogue key capability-call renders with,
  // so the check keeps working in every language.
  const searchedPrefix = `${t("status.cap_past_search")} `;
  const allSearches = calls.length > 0 && calls.every((call) =>
    getCapabilityCallSentence(call, { includeQuery: false }).past.startsWith(searchedPrefix));
  if (allSearches && names) {
    return options.running
      ? t("status.cmd_searching_services", { names })
      : t("status.cmd_searched_services", { names });
  }
  if (!names) {
    return options.running ? t("status.cmd_looking_up_information") : t("status.cmd_looked_up_information");
  }
  return options.running
    ? t("status.cmd_looking_up", { names })
    : t("status.cmd_looked_up", { names });
}

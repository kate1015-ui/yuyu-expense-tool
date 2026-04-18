import { useState, useEffect } from "react";

const KEY = "yuyu_report_templates";

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
}

export function useReportTemplates() {
  const [templates, setTemplates] = useState(load);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(templates));
  }, [templates]);

  function addTemplate(tpl) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setTemplates(prev => [{ ...tpl, id }, ...prev]);
  }

  function removeTemplate(id) {
    setTemplates(prev => prev.filter(t => t.id !== id));
  }

  return { templates, addTemplate, removeTemplate };
}

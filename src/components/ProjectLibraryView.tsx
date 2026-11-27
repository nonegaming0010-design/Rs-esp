import { ArrowUpRight, Code2, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BEGINNER_PROJECTS, PROJECT_CATEGORIES } from '../data/projects/index';
import type { BoardFamily, EspProject } from '../types/esp';
import { filterProjects } from '../utils/espHelpers';

interface ProjectLibraryViewProps {
  onLoadProject: (project: EspProject) => void;
  isPhoneView?: boolean;
}

export function ProjectLibraryView({ onLoadProject, isPhoneView = false }: ProjectLibraryViewProps) {
  const [query, setQuery] = useState('');
  const [boardFilter, setBoardFilter] = useState<'all' | BoardFamily>('all');
  const [category, setCategory] = useState<string>('All');
  const [difficulty, setDifficulty] = useState<'all' | 'Beginner' | 'Intermediate'>('all');
  const [previewProject, setPreviewProject] = useState<EspProject | null>(null);

  const filtered = useMemo(
    () =>
      filterProjects(BEGINNER_PROJECTS, {
        query,
        boardFilter,
        category,
        difficulty,
      }),
    [query, boardFilter, category, difficulty]
  );

  return (
    <section aria-label="100+ Beginner ESP Projects" className="space-y-4">
      {/* Classic Clean Filter Header */}
      <div className="rounded-lg border border-stone-300 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
              {BEGINNER_PROJECTS.length} Beginner-Ready ESP Projects
            </h1>
            <p className="mt-0.5 text-xs text-stone-600 dark:text-stone-400">
              Complete Arduino &amp; MicroPython sketches with wiring tables for ESP32 and ESP8266.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400"
                aria-hidden="true"
              />
              <label htmlFor="project-search" className="sr-only">
                Search projects by sensor, module, or keyword
              </label>
              <input
                id="project-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search DHT22, OLED, MQTT..."
                className="w-full rounded-md border border-stone-300 bg-stone-50 pl-8 pr-3 py-1.5 text-xs text-stone-900 placeholder:text-stone-400 focus:border-teal-700 focus:bg-white focus:outline-none dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
              />
            </div>

            <div
              role="group"
              aria-label="Filter by ESP board family"
              className="flex items-center gap-0.5 rounded-md border border-stone-300 bg-stone-100 p-0.5 dark:border-stone-700 dark:bg-stone-800"
            >
              {(['all', 'esp32', 'esp8266'] as const).map((bf) => (
                <button
                  key={bf}
                  type="button"
                  onClick={() => setBoardFilter(bf)}
                  className={`rounded-sm px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    boardFilter === bf
                      ? 'bg-white text-stone-900 dark:bg-stone-950 dark:text-stone-100'
                      : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
                  }`}
                >
                  {bf === 'all' ? 'All' : bf.toUpperCase()}
                </button>
              ))}
            </div>

            <label htmlFor="category-filter" className="sr-only">
              Filter by project category
            </label>
            <select
              id="category-filter"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-800 focus:border-teal-700 focus:outline-none dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200"
            >
              <option value="All">All Categories</option>
              {PROJECT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <label htmlFor="difficulty-filter" className="sr-only">
              Filter by difficulty
            </label>
            <select
              id="difficulty-filter"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as 'all' | 'Beginner' | 'Intermediate')}
              className="rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-800 focus:border-teal-700 focus:outline-none dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200"
            >
              <option value="all">All Levels</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
            </select>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-stone-200 pt-2.5 text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400">
          <span className="tabular-nums">
            Showing {filtered.length} of {BEGINNER_PROJECTS.length} sketches
          </span>
          {(query || boardFilter !== 'all' || category !== 'All' || difficulty !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setBoardFilter('all');
                setCategory('All');
                setDifficulty('all');
              }}
              className="font-medium text-teal-800 hover:underline dark:text-teal-400"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-stone-300 bg-white p-10 text-center dark:border-stone-800 dark:bg-stone-900">
          <p className="font-display text-base font-semibold text-stone-900 dark:text-stone-100">
            No matching ESP projects found
          </p>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Try clearing your search or switching back to All Categories.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setBoardFilter('all');
              setCategory('All');
              setDifficulty('all');
            }}
            className="mt-4 rounded-md bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
          >
            Show All {BEGINNER_PROJECTS.length} Projects
          </button>
        </div>
      ) : (
        <div
          className={`grid gap-3.5 ${
            isPhoneView ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
          }`}
        >
          {filtered.map((project) => (
            <article
              key={project.id}
              className="flex flex-col justify-between rounded-lg border border-stone-300 bg-white p-4 transition-colors hover:border-stone-400 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-700"
            >
              <div>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {project.category} · {project.difficulty} · {project.boards.map((b) => b.toUpperCase()).join(' / ')}
                </p>
                <h2 className="mt-1.5 font-display text-base font-semibold text-stone-900 dark:text-stone-50">
                  {project.title}
                </h2>
                <p className="mt-1 text-sm text-stone-600 dark:text-stone-300 line-clamp-2">
                  {project.summary}
                </p>
                <p className="mt-2 text-xs text-stone-500 dark:text-stone-400 truncate">
                  Parts: {project.parts.join(', ')}
                </p>
              </div>

              <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-stone-100 pt-3 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setPreviewProject(project)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-700 hover:text-stone-900 dark:text-stone-300 dark:hover:text-white"
                >
                  <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Inspect</span>
                </button>
                <button
                  type="button"
                  onClick={() => onLoadProject(project)}
                  className="inline-flex items-center gap-1 rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 dark:bg-teal-600 dark:hover:bg-teal-500"
                >
                  <span>Open in Studio</span>
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Preview Dialog */}
      {previewProject && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-project-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs"
        >
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-stone-300 bg-white shadow-xl dark:border-stone-800 dark:bg-stone-900">
            <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-5 py-4 dark:border-stone-800">
              <div>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {previewProject.category} · {previewProject.difficulty} · {previewProject.boards.map((b) => b.toUpperCase()).join(' / ')}
                </p>
                <h2 id="preview-project-title" className="mt-1 font-display text-lg font-bold text-stone-900 dark:text-stone-50">
                  {previewProject.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPreviewProject(null)}
                aria-label="Close project preview"
                className="rounded-md p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-4 workbench-scroll">
              <p className="text-sm text-stone-700 dark:text-stone-300">{previewProject.summary}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <h3 className="font-semibold text-stone-900 dark:text-stone-100 mb-1.5">Required Parts</h3>
                  <ul className="list-disc pl-4 space-y-1 text-stone-600 dark:text-stone-300">
                    {previewProject.parts.map((part, i) => (
                      <li key={i}>{part}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-stone-900 dark:text-stone-100 mb-1.5">Wiring Connections</h3>
                  <ul className="space-y-1 text-stone-600 dark:text-stone-300">
                    {previewProject.wiring.map((w, i) => (
                      <li key={i}>
                        <span className="font-medium text-stone-800 dark:text-stone-100">{w.from}</span> →{' '}
                        <span className="font-mono text-teal-800 dark:text-teal-400">{w.to}</span>
                        {w.note ? ` (${w.note})` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-stone-900 dark:text-stone-100 mb-1.5">
                  Source Code ({previewProject.framework === 'micropython' ? 'MicroPython' : 'Arduino C++'})
                </h3>
                <pre className="overflow-x-auto rounded-md bg-stone-950 p-4 font-mono text-xs leading-6 text-stone-100 workbench-scroll">
                  {previewProject.code}
                </pre>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-stone-200 px-5 py-3 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setPreviewProject(null)}
                className="rounded-md border border-stone-300 px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  onLoadProject(previewProject);
                  setPreviewProject(null);
                }}
                className="rounded-md bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
              >
                Load into Studio
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

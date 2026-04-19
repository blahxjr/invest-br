'use client'

import { useMemo, useState } from 'react'
import type { DebugLogFile } from '../actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type LogViewerProps = {
  logs: DebugLogFile[]
}

type LogSection = {
  title: string
  lines: string[]
}

function parseSections(markdown: string): LogSection[] {
  const lines = markdown.split('\n')
  const sections: LogSection[] = []
  let current: LogSection = { title: 'Conteúdo completo', lines: [] }

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (current.lines.length > 0) {
        sections.push(current)
      }
      current = { title: line.replace('## ', '').trim(), lines: [] }
      continue
    }
    current.lines.push(line)
  }

  if (current.lines.length > 0) {
    sections.push(current)
  }

  return sections.length > 0 ? sections : [{ title: 'Conteúdo completo', lines: [markdown] }]
}

function renderLineWithHighlight(line: string, index: number) {
  if (line.startsWith('# ')) {
    return (
      <p key={index} className="font-semibold text-sky-700" data-testid="log-line-heading">
        {line}
      </p>
    )
  }

  if (line.startsWith('- ')) {
    return (
      <p key={index} className="pl-2 text-emerald-700" data-testid="log-line-list-item">
        {line}
      </p>
    )
  }

  if (line.startsWith('```')) {
    return (
      <p key={index} className="font-mono text-purple-700" data-testid="log-line-code-fence">
        {line}
      </p>
    )
  }

  return (
    <p key={index} className="text-gray-700">
      {line || ' '}
    </p>
  )
}

function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

export function LogViewer({ logs }: LogViewerProps) {
  const [activeFile, setActiveFile] = useState(logs[0]?.filename ?? '')

  const activeLog = useMemo(
    () => logs.find((item) => item.filename === activeFile) ?? null,
    [logs, activeFile],
  )

  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Logs .md</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Nenhum log markdown disponível.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Logs .md</CardTitle>
          <Button
            disabled={!activeLog}
            onClick={() => {
              if (!activeLog) return
              downloadMarkdown(activeLog.filename, activeLog.content)
            }}
          >
            Download
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={activeFile} onValueChange={setActiveFile}>
          <TabsList className="mb-2 flex h-auto flex-wrap">
            {logs.map((file) => (
              <TabsTrigger key={file.filename} value={file.filename}>
                {file.filename}
              </TabsTrigger>
            ))}
          </TabsList>

          {logs.map((file) => {
            const sections = parseSections(file.content)
            return (
              <TabsContent key={file.filename} value={file.filename}>
                <div className="space-y-3">
                  {sections.map((section, index) => (
                    <details key={`${file.filename}-${index}`} open>
                      <summary className="cursor-pointer rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-800">
                        {section.title}
                      </summary>
                      <div className="mt-2 space-y-1 rounded-md border border-gray-200 bg-white px-3 py-3 font-mono text-xs">
                        {section.lines.map((line, lineIndex) => renderLineWithHighlight(line, lineIndex))}
                      </div>
                    </details>
                  ))}
                </div>
              </TabsContent>
            )
          })}
        </Tabs>
      </CardContent>
    </Card>
  )
}

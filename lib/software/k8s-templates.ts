import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'

export interface K8sManifest {
  apiVersion: string
  kind: string
  metadata: { name: string; labels: Record<string, string>; annotations?: Record<string, string> }
  spec: any
}

export interface K8sConfig {
  namespace: string
  manifests: K8sManifest[]
  ingressHost?: string
  certManager?: boolean
  hpaEnabled?: boolean
  pdbEnabled?: boolean
  serviceMesh?: 'istio' | 'linkerd' | 'none'
}

export async function generateK8sTemplates(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  projectName: string,
  techStack: string[]
): Promise<K8sConfig | null> {
  const systemPrompt = `You are a Kubernetes specialist. Design K8s manifests. Return JSON: {"namespace": "production", "manifests": [{"apiVersion": "apps/v1", "kind": "Deployment|Service|Ingress|ConfigMap|Secret|HPA|PDB|Namespace", "metadata": {"name": "string", "labels": {"app": "string"}}, "spec": {}}], "ingressHost": "app.example.com", "certManager": true, "hpaEnabled": true, "pdbEnabled": true, "serviceMesh": "istio|linkerd|none"}`
  const result = await executeAgentTask(supabase, userId, null,
    `Generate Kubernetes manifests for "${projectName}" using ${(techStack || []).join(', ')}. Include Deployment, Service, Ingress with TLS, HPA, PDB, and ConfigMap.`, { systemPrompt }
  )

  let config: K8sConfig | null = null
  try { config = JSON.parse(result.response || '{}') } catch { return null }
  if (!config?.manifests?.length) return null

  await storeMemory(supabase, userId, {
    category: 'software_learning', tags: [projectId, 'k8s_templates', 'kubernetes'],
    content: { projectId, projectName, manifestCount: config.manifests.length, hasIngress: !!config.ingressHost, hasHpa: config.hpaEnabled, hasPdb: config.pdbEnabled, serviceMesh: config.serviceMesh, generatedAt: new Date().toISOString() },
  })

  return config
}

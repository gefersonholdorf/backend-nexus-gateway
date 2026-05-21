import type { ContainerState, NetworkHost } from "@/types/docker"

type UsedIpInfo = {
  ip: string
  used: boolean
  service?: string | null
  state?: ContainerState | null
}

export function generateNetworkMap(
  networkBase: string,
  usedIps: UsedIpInfo[]
): NetworkHost[] {
  const ipMap = new Map<string, UsedIpInfo>()

  for (const item of usedIps) {
    ipMap.set(item.ip, item)
  }

  const hosts: NetworkHost[] = []

  for (let i = 1; i <= 254; i++) {
    const ip = `${networkBase}.${i}`
    const info = ipMap.get(ip)

    hosts.push({
      ip,
      used: info?.used ?? false,
      service: info?.service ?? null,
      state: info?.state ?? null
    })
  }

  return hosts
}
export interface DockerContainer {
  Command: string
  Created: number
  HostConfig: HostConfig
  Id: string
  Image: string
  ImageID: string
  Labels: Record<string, string>
  Mounts: Mount[]
  Names: string[]
  NetworkSettings: NetworkSettings
  Ports: Port[]
  State: ContainerState
  Status: string
}

export interface HostConfig {
  NetworkMode: string
}

export interface Mount {
  Destination: string
  Mode: string
  Propagation: string
  RW: boolean
  Source: string
  Type: "bind" | "volume" | "tmpfs" | string
}

export interface NetworkSettings {
  Networks: Record<string, DockerNetwork>
}

export interface DockerNetwork {
  Aliases: string[] | null
  DNSNames: string[] | null
  DriverOpts: Record<string, string> | null
  EndpointID: string
  Gateway: string
  GlobalIPv6Address: string
  GlobalIPv6PrefixLen: number
  GwPriority: number
  IPAMConfig: IPAMConfig | null
  IPAddress: string
  IPPrefixLen: number
  IPv6Gateway: string
  Links: string[] | null
  MacAddress: string
  NetworkID: string
}

export interface IPAMConfig {
  IPv4Address?: string
  IPv6Address?: string
}

export interface Port {
  IP: string
  PrivatePort: number
  PublicPort: number
  Type: "tcp" | "udp" | string
}

export type ContainerState =
  | "created"
  | "running"
  | "paused"
  | "restarting"
  | "removing"
  | "exited"
  | "dead"


export type NetworkHost = {
  ip: string
  used: boolean,
  service?: string | null
  state?: ContainerState | null
}

export interface DockerNetwork {
  Name: string

  IPAM?: {
    Config?: Array<{
      Subnet?: string
      Gateway?: string
    }>
  }
}
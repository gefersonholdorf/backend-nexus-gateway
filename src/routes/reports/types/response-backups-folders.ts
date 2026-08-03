export interface SynologyFileListResponse {
  success: boolean;
  data: {
    files: SynologyFile[];
    offset: number;
    total: number;
  };
}

export interface SynologyFile {
  additional: SynologyFileAdditional;
  isdir: boolean;
  name: string;
  path: string;
}

export interface SynologyFileAdditional {
  description: Record<string, never>;
  indexed: boolean;
  mount_point_type: string;
  owner: SynologyFileOwner;
  perm: SynologyFilePermission;
  real_path: string;
  size: number;
  time: SynologyFileTime;
  type: string;
}

export interface SynologyFileOwner {
  gid: number;
  group: string;
  uid: number;
  user: string;
}

export interface SynologyFilePermission {
  acl: SynologyFileAcl;
  is_acl_mode: boolean;
  posix: number;
}

export interface SynologyFileAcl {
  append: boolean;
  del: boolean;
  exec: boolean;
  read: boolean;
  write: boolean;
}

export interface SynologyFileTime {
  atime: number;
  crtime: number;
  ctime: number;
  mtime: number;
}
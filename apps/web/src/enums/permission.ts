export enum ProfileReqType {
  Delete = 'delete',
  Restore = 'restore',

  Favorite = 'favorite',

  CookieRobot = 'cookie_robot',
  EditCookie = 'edit_cookie',

  EditRemark = 'edit_remark',

  AddProxy = 'add_proxy',
  EditProxy = 'edit_proxy',
  DeleteProxy = 'delete_proxy',
  SelectProxy = 'select_proxy',
  SpeedTest = 'profiles_speed_test',

  AddPlatform = 'add_platform',
  EditPlatform = 'edit_platform',
  SelectPlatform = 'select_platform',

  SelectLabel = 'select_label',

  MoveProject = 'move_project',

  Recycle = 'recycle',
}

export enum ProjectReqType {
  PinProject = 'pin_project',
}

export enum ProxyReqType {
  EditRemark = 'edit_remark',
  SpeedTest = 'speed_test',
}

export enum PlatformReqType {
  EditRemark = 'edit_remark',
}

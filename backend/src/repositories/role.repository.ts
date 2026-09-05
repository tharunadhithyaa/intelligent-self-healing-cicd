import { BaseRepository } from "./base.repository";
import Role, { IRoleDocument } from "../models/role.model";

export class RoleRepository extends BaseRepository<IRoleDocument> {
  constructor() {
    super(Role);
  }
}

export const roleRepository = new RoleRepository();

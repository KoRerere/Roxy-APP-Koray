import { defineStore } from 'pinia'
import type { Member } from '~/neko/types'

interface Members {
  [id: string]: Member
}

const sanitizeDisplayname = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export const state = () => ({
  id: '',
  members: {} as Members,
})

export const useUserStore = defineStore('user', {
  state,
  getters: {
    member: (state) => state.members[state.id] || null,
    admin: (state) => Boolean(state.members[state.id]?.admin),
  },
  actions: {
    setMuted({ id, muted }: { id: string; muted: boolean }) {
      this.members[id] = {
        ...this.members[id],
        muted,
      }
    },
    setMembers(members: Member[]) {
      const data: Members = {}
      for (const member of members) {
        data[member.id] = {
          connected: true,
          ...member,
          displayname: sanitizeDisplayname(member.displayname),
        }
      }
      this.members = data
    },
    setMember(id: string) {
      this.id = id
    },
    addMember(member: Member) {
      this.members = {
        ...this.members,
        [member.id]: {
          connected: true,
          ...member,
          displayname: sanitizeDisplayname(member.displayname),
        },
      }
    },
    delMember(id: string) {
      this.members[id] = {
        ...this.members[id],
        connected: false,
      }
    },
    reset() {
      this.members = {}
    },
  },
})

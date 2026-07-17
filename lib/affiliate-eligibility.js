export const ACTIVE_CREW_MEMBER_WHERE = Object.freeze({
  status: 'approved',
  deletedAt: null,
});

export function isActiveCrewMember(member) {
  return member?.status === ACTIVE_CREW_MEMBER_WHERE.status && !member.deletedAt;
}

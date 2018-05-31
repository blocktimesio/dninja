let roles = {
  0: {
    title: `guest`,
    can: [],
  },
  1: {
    title: `user`,
    can: [
      
    ],
  },
  2: {
    title: `admin`,
    can: [
      `articleAdd`,
      `articleDel`,
      `commentsDel`,
      `commentsSeeDeleted`,
      `personsAdd`,
      `personsDel`,
      `coinsAdd`,
      `coinsDel`,
      `pageAdd`,
      `pageDel`,
      `settings`,
      `usersSettings`,
    ],
  },
  3: {
    title: `editor`,
    can: [
      `articleAdd`,
      `commentsDel`,
    ],
  },
};

class permsChecker {
  constructor (roleId) {
    this.roleId = roleId;
  }
  
  check (perm) {
    let role = roles[this.roleId];
    return (role.can.indexOf(perm) !== -1);
  }
}

module.exports = {
  roles,
  permsChecker,
};

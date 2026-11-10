/**
 * Classification & soft-delete contracts for dual-hat messaging.
 * These mirror ConversationsService list/admin helpers without a live DB.
 */

type Side = 'as_customer' | 'as_provider';

function classifyViewer(
  userId: number,
  conversation: { customerId: number; providerId: number },
): Side | null {
  if (conversation.customerId === userId) return 'as_customer';
  if (conversation.providerId === userId) return 'as_provider';
  return null;
}

function listFilter(
  userId: number,
  as: 'customer' | 'provider',
  rows: { id: number; customerId: number; providerId: number; deletedAt: Date | null }[],
) {
  return rows.filter((row) => {
    if (row.deletedAt) return false;
    return as === 'customer'
      ? row.customerId === userId
      : row.providerId === userId;
  });
}

function adminSearchMatch(
  q: string,
  row: {
    id: number;
    customerName: string;
    customerEmail: string;
    providerName: string;
    lastMessage: string;
    messageTexts: string[];
  },
) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const idHit = String(row.id) === needle;
  const hay = [
    row.customerName,
    row.customerEmail,
    row.providerName,
    row.lastMessage,
    ...row.messageTexts,
  ]
    .join(' ')
    .toLowerCase();
  return idHit || hay.includes(needle);
}

describe('conversation participant classification', () => {
  const dualHatUser = 10;
  const otherCustomer = 20;
  const otherProvider = 30;

  const rows = [
    // Dual-hat user contacted another provider (personal / floating)
    {
      id: 1,
      customerId: dualHatUser,
      providerId: otherProvider,
      deletedAt: null as Date | null,
    },
    // Another customer inquired about dual-hat user's services (Customer Inquiries)
    {
      id: 2,
      customerId: otherCustomer,
      providerId: dualHatUser,
      deletedAt: null as Date | null,
    },
    // Soft-deleted personal thread
    {
      id: 3,
      customerId: dualHatUser,
      providerId: otherProvider,
      deletedAt: new Date(),
    },
  ];

  it('classifies by participation, not global account role', () => {
    expect(classifyViewer(dualHatUser, rows[0])).toBe('as_customer');
    expect(classifyViewer(dualHatUser, rows[1])).toBe('as_provider');
    expect(classifyViewer(999, rows[0])).toBeNull();
  });

  it('keeps personal and inquiry lists disjoint for the same user', () => {
    const personal = listFilter(dualHatUser, 'customer', rows);
    const inquiries = listFilter(dualHatUser, 'provider', rows);
    expect(personal.map((r) => r.id)).toEqual([1]);
    expect(inquiries.map((r) => r.id)).toEqual([2]);
    expect(personal.some((r) => inquiries.some((i) => i.id === r.id))).toBe(
      false,
    );
  });

  it('excludes soft-deleted conversations from active lists', () => {
    expect(listFilter(dualHatUser, 'customer', rows).map((r) => r.id)).not.toContain(
      3,
    );
  });
});

describe('admin conversation search matching', () => {
  const row = {
    id: 42,
    customerName: 'Ada Lovelace',
    customerEmail: 'ada@example.com',
    providerName: 'Kente Studio',
    lastMessage: 'Need a custom wrap',
    messageTexts: ['Looking for indigo dye'],
  };

  it('matches customer name, email, artisan, subject, id, and message text', () => {
    expect(adminSearchMatch('Ada', row)).toBe(true);
    expect(adminSearchMatch('ada@example.com', row)).toBe(true);
    expect(adminSearchMatch('Kente', row)).toBe(true);
    expect(adminSearchMatch('custom wrap', row)).toBe(true);
    expect(adminSearchMatch('42', row)).toBe(true);
    expect(adminSearchMatch('indigo', row)).toBe(true);
    expect(adminSearchMatch('no-such-term', row)).toBe(false);
  });
});

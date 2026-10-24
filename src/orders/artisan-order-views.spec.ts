import { artisanOrderView, artisanOrderViews, summarizeArtisanOrders } from './artisan-order-views';

describe('artisan order views', () => {
  it('maps stored statuses onto New, Pending, and Completed', () => {
    expect(artisanOrderView('pending')).toBe('new');
    expect(artisanOrderViews('pending')).toEqual(['new', 'pending']);
    expect(artisanOrderView('confirmed')).toBe('pending');
    expect(artisanOrderViews('confirmed')).toEqual(['pending']);
    expect(artisanOrderView('in_progress')).toBe('pending');
    expect(artisanOrderView('ready')).toBe('pending');
    expect(artisanOrderView('shipped')).toBe('pending');
    expect(artisanOrderView('approved')).toBe('pending');
    expect(artisanOrderView('delivered')).toBe('completed');
    expect(artisanOrderView('cancelled')).toBe('other');
    expect(artisanOrderView('rejected')).toBe('other');
    expect(artisanOrderView('completed')).toBe('other');
    expect(artisanOrderView('awaiting_payment')).toBe('other');
  });

  it('counts a newly placed order in both New and Pending', () => {
    expect(
      summarizeArtisanOrders([
        { status: 'pending', count: 2 },
        { status: 'confirmed', count: 1 },
        { status: 'delivered', count: 4 },
        { status: 'cancelled', count: 3 },
      ]),
    ).toEqual({ new: 2, pending: 3, completed: 4, all: 10 });
  });
});

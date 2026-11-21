import {
  genuineArtisanReviewScope,
  genuineOrderScope,
  genuineProductReviewScope,
} from './genuine-data';

describe('genuine commerce scopes', () => {
  it('excludes simulator orders from commerce totals and rankings', () => {
    expect(genuineOrderScope).toEqual({ isTestOrder: false });
  });

  it('excludes test customers and test-order reviews from public analytics', () => {
    for (const scope of [
      genuineProductReviewScope,
      genuineArtisanReviewScope,
    ]) {
      expect(scope).toEqual(
        expect.objectContaining({
          customer: { isTestUser: false },
          OR: [{ orderId: null }, { order: { is: { isTestOrder: false } } }],
        }),
      );
    }
  });
});

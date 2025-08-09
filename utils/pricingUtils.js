// Վերջնական գնի հաշվարկ
export function getFinalPriceWithDiscount(variant) {
  const now = new Date();

  if (
    variant.discount &&
    variant.discount.isActive &&
    variant.discount.validUntil &&
    new Date(variant.discount.validUntil) > now &&
    typeof variant.discount.percentage === 'number' &&
    variant.discount.percentage > 0
  ) {
    const discountAmount = variant.price * (variant.discount.percentage / 100);
    const finalPrice = variant.price - discountAmount;

    return Math.round(finalPrice);
  }

  return variant.price;
}

// Մանրամասն զեղչի հաշվարկ (ցուցադրության համար)
export function calculateDiscountDetails(variant) {
  const now = new Date();

  if (
    variant.discount &&
    variant.discount.isActive &&
    variant.discount.validUntil &&
    new Date(variant.discount.validUntil) > now &&
    typeof variant.discount.percentage === 'number' &&
    variant.discount.percentage > 0
  ) {
    const discountAmount = variant.price * (variant.discount.percentage / 100);
    const finalPrice = variant.price - discountAmount;

    return {
      basePrice: variant.price,
      discountPercentage: variant.discount.percentage,
      discountAmount: Math.round(discountAmount),
      finalPrice: Math.round(finalPrice),
    };
  }

  return {
    basePrice: variant.price,
    discountPercentage: 0,
    discountAmount: 0,
    finalPrice: variant.price,
  };
}
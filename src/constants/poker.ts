export const SEQUENCES = {
    fibonacci: ['1', '2', '3', '5', '8', '13', '21', '?'],
    tshirt: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?'],
    powers: ['1', '2', '4', '8', '16', '32', '64', '?']
} as const

export const SEQUENCE_LABELS = {
    fibonacci: 'Fibonacci (1, 2, 3, 5, 8, 13, 21)',
    tshirt: 'T-Shirt Sizes (XS, S, M, L, XL, XXL)',
    powers: 'Powers of 2 (1, 2, 4, 8, 16, 32, 64)'
} as const

export type SequenceType = keyof typeof SEQUENCES

declare module 'ml-regression' {
  export class SimpleLinearRegression {
    constructor(x: number[], y: number[]);
    predict(x: number): number;
    slope: number;
    intercept: number;
    coefficients: number[];
    score(): number;
    coefficientOfDetermination: number;
    toString(): string;
  }

  export class MultivariateLinearRegression {
    constructor(x: number[][] | any, y: number[] | any);
    predict(x: number[][]): number[];
    weights: number[];
    intercept: number;
    score(): number;
    toString(): string;
  }

  export class PolynomialRegression {
    constructor(x: number[], y: number[], degree: number);
    predict(x: number): number;
    coefficients: number[];
    score(): number;
  }
}
import {readBlogPage} from './page';

describe('Given the blog page receives URL state', () => {
  it.each([
    {input: null, expectedPage: 1, expectedInvalid: false},
    {input: '1', expectedPage: 1, expectedInvalid: false},
    {input: '2', expectedPage: 2, expectedInvalid: false},
    {input: '100', expectedPage: 100, expectedInvalid: false},
  ])('When the URL query contains $input Then it yields page $expectedPage with invalid $expectedInvalid', ({input, expectedPage, expectedInvalid}) => {
    expect(readBlogPage(input)).toEqual({page: expectedPage, invalid: expectedInvalid});
  });
  it.each([
    {input: '', expectedPage: 1, expectedInvalid: true},
    {input: '0', expectedPage: 1, expectedInvalid: true},
    {input: '-1', expectedPage: 1, expectedInvalid: true},
    {input: '2.5', expectedPage: 1, expectedInvalid: true},
    {input: 'NaN', expectedPage: 1, expectedInvalid: true},
    {input: 'Infinity', expectedPage: 1, expectedInvalid: true},
    {input: '02', expectedPage: 1, expectedInvalid: true},
    {input: '2e1', expectedPage: 1, expectedInvalid: true},
    {input: ' 2 ', expectedPage: 1, expectedInvalid: true},
    {input: '9007199254740991', expectedPage: 1, expectedInvalid: true},
  ])('When the URL query is invalid and contains $input Then it yields page $expectedPage with invalid $expectedInvalid', ({input, expectedPage, expectedInvalid}) => {
    expect(readBlogPage(input)).toEqual({page: expectedPage, invalid: expectedInvalid});
  });
});

import {readBlogPage} from './page';

describe('Blog page URL contract', () => {
  it.each([null, '1', '2', '100'])('[social-page-valid] accepts positive decimal page %s', value => {
    expect(readBlogPage(value)).toEqual({page: value === null ? 1 : Number(value), invalid: false});
  });
  it.each(['', '0', '-1', '2.5', 'NaN', 'Infinity', '02', '2e1', ' 2 ', '9007199254740991'])('[social-page-invalid] rejects noncanonical or unsafe page %s', value => {
    expect(readBlogPage(value)).toEqual({page: 1, invalid: true});
  });
});

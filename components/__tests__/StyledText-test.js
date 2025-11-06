import { render } from '@testing-library/react-native';

import MyComponent from '../MyComponent';
import { MonoText } from '../StyledText';

test('renderiza corretamente', () => {
  const { getByText } = render(<MyComponent />);
  expect(getByText('Texto esperado')).toBeTruthy();
});

it(`renders correctly`, () => {
  const tree = renderer.create(<MonoText>Snapshot test!</MonoText>).toJSON();

  expect(tree).toMatchSnapshot();
});

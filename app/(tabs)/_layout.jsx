import { Tabs } from "expo-router";
import CustomTabBar from "../../components/CustomTabBar";
import { useHideNavigationBar } from '@hooks/useNavigationBar';

export default function TabsLayout() {
    useHideNavigationBar();

    return (
        <Tabs tabBar={props => <CustomTabBar {...props} />} />
    );
}
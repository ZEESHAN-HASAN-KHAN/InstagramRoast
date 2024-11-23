import { useState } from "react";
import { Button } from "./button";

import { useTheme } from "./theme-provider";
export function Test()
{
    const [t, sT] = useState('dark')
    const { setTheme } = useTheme();
    return <>
        <Button onClick={() => {
            if (t == 'dark')
            {
                setTheme('light')
                sT('light')
            }
            else
            {
                setTheme('dark');
                sT('dark')
            }
        }}>Click me</Button>
    </>
}
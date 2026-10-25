"""Unlock only a dedicated qemu emulator with its known synthetic test PIN."""
import time
import xml.etree.ElementTree as ET

def unlock(adb):
    if adb('shell','getprop','ro.kernel.qemu').strip()!='1':raise ValueError('SYNTHETIC_EMULATOR_ONLY')
    adb('shell','input','keyevent','224');adb('shell','input','keyevent','82');time.sleep(.5)
    adb('shell','uiautomator','dump','/data/local/tmp/sonri-test-keyguard.xml')
    tree=ET.fromstring(adb('shell','cat','/data/local/tmp/sonri-test-keyguard.xml'))
    if any(n.attrib.get('resource-id')=='com.android.systemui:id/key_enter' for n in tree.iter('node')):
        adb('shell','input','text','135790');adb('shell','input','keyevent','66');time.sleep(.5)
    adb('shell','svc','power','stayon','true')

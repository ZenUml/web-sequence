import { useState, useEffect } from 'preact/hooks';
function SaveStatusButton({ isSaving }) {
  const [isShowTip, setShowTip] = useState(false);
  const [isShowSaved, setShowSaved] = useState(false);
  const handleMouseEnter = () => {
    setShowTip(true);
  };

  const handleMouseLeave = () => {
    setShowTip(false);
  };
  let showSavedTimeout = null;
  useEffect(() => {
    if (isSaving == false) {
      setShowSaved(true);
      if (showSavedTimeout) clearTimeout(showSavedTimeout);
      showSavedTimeout = setTimeout(() => {
        setShowSaved(false);
      }, 1500);
    }
  }, [isSaving]);

  return (
    <div class="relative flex">
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        class="relative flex space-x-1"
      >
        <div>
          <span
            className={`${isShowSaved ? '' : 'bg-black-600'} h-6 w-6 rounded-lg  flex items-center justify-center`}
          >
            <svg class="h-5 w-5" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M9.16699 15.0033H5.54783C3.40449 15 1.66699 13.3275 1.66699 11.2642C1.66699 9.20165 3.40449 7.52915 5.54783 7.52915C5.87533 6.06082 7.04283 4.86249 8.61033 4.38499C10.177 3.90832 11.907 4.22415 13.147 5.21832C14.387 6.20999 14.9487 7.72415 14.622 9.19249H15.447C16.6037 9.19249 17.6012 9.87582 18.062 10.865M12.5003 15.8333L14.167 17.5L17.5003 14.1667"
                stroke="#DBFAE6"
                stroke-width="1.66667"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </span>
        </div>
        {isShowSaved && (
          <div class="min-w-0 flex-1 flex items-center justify-center">
            <p class="text-sm text-gray-500">Saved to cloud</p>
          </div>
        )}
      </div>
      {isShowTip && (
        <div class="border border-gray-300 mt-8 absolute bg-green-50  rounded text-sm z-50 flex items-center justify-center right-auto left-0 transform -translate-x-1/2">
          <div>
            <span class="h-5 w-5 rounded-lg flex items-center justify-center">
              <svg
                class="h-4 w-4"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M7.33398 10.0027H4.43865C2.72398 10 1.33398 8.66201 1.33398 7.01134C1.33398 5.36134 2.72398 4.02334 4.43865 4.02334C4.70065 2.84868 5.63465 1.89001 6.88865 1.50801C8.14198 1.12668 9.52598 1.37934 10.518 2.17468C11.51 2.96801 11.9593 4.17934 11.698 5.35401H12.358C13.2833 5.35401 14.0813 5.90068 14.45 6.69201M10.0007 10.6667L11.334 12L14.0007 9.33334"
                  stroke="#08895A"
                  stroke-width="1.33333"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
          </div>
          <div class="whitespace-nowrap flex-1 flex items-center justify-center ">
            <p class="text-xs text-black p-1">All changes auto-save to cloud</p>
          </div>
        </div>
      )}
    </div>
  );
}

export { SaveStatusButton };

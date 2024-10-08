import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome } from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from 'react-router-dom';
import React, { useState, useEffect, useContext } from 'react';
import Modal from 'react-modal';
import GlobalContext from '../context/ContextProvider'; 
import squadImg from "../assets/squad.png";
import supabase from '../supabaseClient';

const Squad = () => {
  const navigate = useNavigate();
  const { state: { DataUser }, setDataUser } = useContext(GlobalContext);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSquad, setSelectedSquad] = useState(null);
  const [squads, setSquads] = useState([]);
  const [joinedSquadId, setJoinedSquadId] = useState(null);

  useEffect(() => {
    const handleBackButtonClick = () => {
      navigate(`/?telegram_id=${DataUser.telegram_id}&username=${DataUser.username}&telegram_name=${encodeURIComponent(DataUser.telegram_name)}&profile_photo_url=${encodeURIComponent(DataUser.profile_photo_url)}`);
    };
    const BackButton = window.Telegram.WebApp.BackButton;
    BackButton.show();
    BackButton.onClick(handleBackButtonClick);

    return () => {
      BackButton.hide();
      BackButton.offClick(handleBackButtonClick);
    };
  }, [navigate, DataUser.profile_photo_url, DataUser.telegram_id, DataUser.telegram_name, DataUser.username]);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('telegram_id', DataUser?.telegram_id);

        if (error) {
          throw error;
        }

        setDataUser(data[0]);

        if (data[0]?.squad_id) {
          setJoinedSquadId(data[0].squad_id);
        }
      } catch (error) {
        console.error('Error fetching user data:', error.message);
      }
    };

    if (DataUser) {
      fetchUserData();
    }
  }, [DataUser, setDataUser]);

  useEffect(() => {
    const fetchSquads = async () => {
      try {
        const { data: squadData, error: squadError } = await supabase
          .from('squads')
          .select('*');
  
        if (squadError) {
          throw squadError;
        }
  
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('squad_id, coins');
  
        if (usersError) {
          throw usersError;
        }
  
        const squadsWithDetails = await Promise.all(squadData.map(async squad => {
          const { data: membersData, error: membersError } = await supabase
            .from('squad_member')
            .select('user_id')
            .eq('squad_id', squad.squad_id);
  
          if (membersError) {
            throw membersError;
          }
  
          const totalCoins = usersData
            .filter(user => user.squad_id === squad.squad_id)
            .reduce((sum, user) => sum + user.coins, 0);
  
          const { error: updateSquadError } = await supabase
            .from('squads')
            .update({ squad_coins: totalCoins, squad_member: membersData.length })
            .eq('squad_id', squad.squad_id);
  
          if (updateSquadError) {
            throw updateSquadError;
          }
  
          return {
            ...squad,
            totalCoins,
            totalMembers: membersData.length
          };
        }));
  
        setSquads(squadsWithDetails);
      } catch (error) {
        console.error('Error fetching squads:', error.message);
      }
    };
  
    fetchSquads();
  }, []);
  
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('telegram_id', DataUser?.telegram_id);
  
        if (error) {
          throw error;
        }
  
        setDataUser(data[0]);
  
        if (data[0]?.squad_id) {
          setJoinedSquadId(data[0].squad_id);
        }
      } catch (error) {
        console.error('Error fetching user data:', error.message);
      }
    };
  
    if (DataUser) {
      fetchUserData();
    }
  }, [DataUser, setDataUser]);  

  const openModal = (squad) => {
    setSelectedSquad(squad);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedSquad(null);
  };

  const joinSquad = async (squad) => {
    const user_id = DataUser.telegram_id;
    const timestamp = new Date().toISOString();
    try {
      const { data: userSquad, error: userSquadError } = await supabase
        .from('squad_member')
        .select('squad_id')
        .eq('user_id', user_id);

      if (userSquadError) {
        throw userSquadError;
      }

      if (userSquad.length > 0) {
        const oldSquadId = userSquad[0].squad_id;

        const { error: deleteMemberError } = await supabase
          .from('squad_member')
          .delete()
          .eq('user_id', user_id)
          .eq('squad_id', oldSquadId);

        if (deleteMemberError) {
          throw deleteMemberError;
        }

        const { data: remainingMembers, error: remainingMembersError } = await supabase
          .from('squad_member')
          .select('user_id')
          .eq('squad_id', oldSquadId);

        if (remainingMembersError) {
          throw remainingMembersError;
        }

        const { data: remainingUsersData, error: remainingUsersError } = await supabase
          .from('users')
          .select('coins')
          .in('telegram_id', remainingMembers.map(member => member.user_id));

        if (remainingUsersError) {
          throw remainingUsersError;
        }

        const newTotalCoins = remainingUsersData.reduce((sum, user) => sum + user.coins, 0);

        const { error: updateOldSquadError } = await supabase
          .from('squads')
          .update({
            squad_coins: newTotalCoins,
            squad_member: remainingMembers.length
          })
          .eq('squad_id', oldSquadId);

        if (updateOldSquadError) {
          throw updateOldSquadError;
        }
      }

      const { error: squadMemberError } = await supabase
        .from('squad_member')
        .insert([{ user_id, squad_id: squad.squad_id, joined_at: timestamp }]);

      if (squadMemberError) {
        throw squadMemberError;
      }

      const { error: userUpdateError } = await supabase
        .from('users')
        .update({ squad_id: squad.squad_id })
        .eq('telegram_id', user_id);

      if (userUpdateError) {
        throw userUpdateError;
      }

      const { data: newMembersData, error: newMembersError } = await supabase
        .from('squad_member')
        .select('user_id')
        .eq('squad_id', squad.squad_id);

      if (newMembersError) {
        throw newMembersError;
      }

      const { data: newUsersData, error: newUsersError } = await supabase
        .from('users')
        .select('squad_id, coins')
        .eq('squad_id', squad.squad_id);

      if (newUsersError) {
        throw newUsersError;
      }

      const newTotalCoins = newUsersData.reduce((sum, user) => sum + user.coins, 0);

      const { error: updateSquadError } = await supabase
        .from('squads')
        .update({ squad_coins: newTotalCoins, squad_member: newMembersData.length })
        .eq('squad_id', squad.squad_id);

      if (updateSquadError) {
        throw updateSquadError;
      }

      navigate(`/pages/squad-room?telegram_id=${DataUser.telegram_id}&username=${DataUser.username}&telegram_name=${encodeURIComponent(DataUser.telegram_name)}&profile_photo_url=${encodeURIComponent(DataUser.profile_photo_url)}`);
    } catch (error) {
      console.error('Error joining squad:', error.message);
    }
  };

  return (
    <div className="bg-bgtetris bg-cover bg-center min-h-screen flex flex-col items-center justify-start font-mono">
      <div className="flex flex-col items-center justify-start pt-20">
      {joinedSquadId && (
          <FontAwesomeIcon
            className='p-2 bg-yellow-400 outline rounded-lg text-left absolute top-0 left-0 ml-4 mt-5 cursor-pointer'
            icon={faHome}
            onClick={() => navigate(`/pages/squad-room?telegram_id=${DataUser.telegram_id}&username=${DataUser.username}&telegram_name=${encodeURIComponent(DataUser.telegram_name)}&profile_photo_url=${encodeURIComponent(DataUser.profile_photo_url)}`)}
          />
        )}
        <img src={squadImg} alt="Squad Logo" className="w-28 h-32 bg-slate-700 px-4 py-2 rounded-lg" />
      </div>
      <div className='w-full px-4'>
        <div className="bg-teal-800 mt-10 mb-2 rounded-md p-4 flex-col">
          <div className='text-center text-yellow-400 font-bold font-mono bg-teal-900 rounded-lg py-2 mb-4 outline'>
            Squad List
          </div>
          <div className="flex flex-col text-white text-xs overflow-y-auto">
            {squads.map((squad) => (
              <div key={squad.squad_id}  className="flex justify-between p-2 border-b border-slate-300">
                <div>
                  <span className="font-bold text-white">{squad.squad_name}</span>
                  <p className='text-xs text-yellow-500'>{squad.squad_description}</p>
                </div>
                {joinedSquadId === squad.squad_id ? (
                  <button className="bg-blue-500 text-center w-1/5 rounded-md px-1 flex text-white font-bold border-2 border-blue-700 flex-col items-center justify-center transform hover:scale-105 active:scale-95 text-xs md:flex-none">
                    Joined
                  </button>
                ) : (
                  <button className="bg-yellow-500 text-center w-1/5 rounded-md px-1 flex text-white font-bold border-2 border-yellow-700 flex-col items-center justify-center transform hover:scale-105 active:scale-95 text-xs md:flex-none" onClick={() => openModal(squad)}>
                    Join
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <Modal
        isOpen={isModalOpen}
        onRequestClose={closeModal}
        contentLabel="Join Squad Modal"
        className="modal font-mono"
        overlayClassName="modal-overlay"
      >
        {selectedSquad && (
          <div className="modal-content flex flex-col items-center">
            <h2 className="text-lg text-white bg-yellow-700 px-2 rounded-full text-center font-bold mb-4"> {selectedSquad && selectedSquad.squad_name}</h2>
            <div className="flex justify-between w-full">
              <div className="text-center">
                <h1 className='text-white text-sm'>Total Member</h1>
                <p className='text-yellow-500'> {selectedSquad && selectedSquad.totalMembers}</p>
              </div>
              <div className="text-center">
                <h1 className='text-white text-sm'>Squad Point</h1>
                <p className='text-yellow-500'> {selectedSquad && selectedSquad.totalCoins}</p>
              </div>
            </div>
            <button
              className="mt-4 bg-blue-700 text-center w-1/5 rounded-md py-2 px-7 flex text-white font-bold border-4 border-blue-400  flex-col items-center justify-center transform hover:scale-105 active:scale-95 text-sm md:flex-nonemd" onClick={() => { joinSquad(selectedSquad); closeModal(); }}>
              Join
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Squad;